import { isClosed } from "@/lib/hours";
import { addEvent, claimSid, getSettings } from "@/lib/store";
import {
  assertTwilioSignature,
  dialTwiml,
  emptyTwiml,
  formDataToParams,
  getTwilioEnv,
  sayAndSmsTwiml,
  sayTwiml,
  sendSms,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const params = formDataToParams(formData);

  const signature = assertTwilioSignature(request, params);
  if (!signature.ok) {
    return new Response(signature.body, { status: signature.status });
  }

  const from = params.From ?? "";
  const to = params.To ?? getTwilioEnv().phoneNumber;
  const callSid = params.CallSid ?? "";
  const { ownerPhone } = getTwilioEnv();

  if (!(await claimSid(callSid))) {
    const settings = await getSettings();
    if (isClosed(settings)) {
      return closedCallTwiml(settings.businessName, settings.closedMessage, from);
    }
    return ownerPhone ? dialTwiml(ownerPhone) : emptyTwiml();
  }

  await addEvent({
    sid: callSid,
    channel: "voice",
    direction: "in",
    from,
    to,
    snippet: "Incoming call",
    kind: "inbound",
  });

  const settings = await getSettings();
  if (isClosed(settings)) {
    let sentViaRest = false;
    try {
      sentViaRest = Boolean(await sendSms(from, settings.closedMessage));
    } catch (error) {
      console.error("Closed-call SMS failed", error);
    }

    await addEvent({
      sid: `${callSid}-out`,
      channel: "sms",
      direction: "out",
      from: to,
      to: from,
      snippet: settings.closedMessage,
      kind: "call-closed",
    });

    if (sentViaRest) {
      return sayTwiml(voicePrompt(settings.businessName));
    }

    return closedCallTwiml(settings.businessName, settings.closedMessage, from);
  }

  await addEvent({
    sid: `${callSid}-dial`,
    channel: "voice",
    direction: "out",
    from: to,
    to: ownerPhone || "unset OWNER_PHONE",
    snippet: ownerPhone
      ? `Ringing owner ${ownerPhone}`
      : "OWNER_PHONE not set",
    kind: "call-open",
  });

  if (!ownerPhone) {
    return sayTwiml("This line is open, but the owner number is not configured.");
  }

  return dialTwiml(ownerPhone);
}

function voicePrompt(businessName: string): string {
  return `${businessName} is closed. We'll text you now.`;
}

function closedCallTwiml(
  businessName: string,
  closedMessage: string,
  caller: string,
): Response {
  return sayAndSmsTwiml(voicePrompt(businessName), closedMessage, caller);
}
