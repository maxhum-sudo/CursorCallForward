import { isClosed } from "@/lib/hours";
import { addEvent, claimSid, getSettings } from "@/lib/store";
import {
  assertTwilioSignature,
  emptyTwiml,
  formDataToParams,
  getTwilioEnv,
  messageTwiml,
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
  const body = params.Body ?? "";
  const messageSid = params.MessageSid ?? "";

  if (!(await claimSid(messageSid))) {
    return emptyTwiml();
  }

  await addEvent({
    sid: messageSid,
    channel: "sms",
    direction: "in",
    from,
    to,
    snippet: body || "(empty)",
    kind: "inbound",
  });

  const settings = await getSettings();
  if (!isClosed(settings)) {
    return emptyTwiml();
  }

  await addEvent({
    sid: `${messageSid}-out`,
    channel: "sms",
    direction: "out",
    from: to,
    to: from,
    snippet: settings.closedMessage,
    kind: "auto-reply",
  });

  return messageTwiml(settings.closedMessage);
}
