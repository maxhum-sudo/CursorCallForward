import twilio from "twilio";

export function getTwilioEnv() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    phoneNumber: (
      process.env.TWILIO_PHONE_NUMBER ??
      process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ??
      "+15873280731"
    )
      .trim()
      .replace(/^["']|["']$/g, ""),
    ownerPhone: process.env.OWNER_PHONE ?? "",
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
  };
}

export function formDataToParams(
  formData: FormData,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
}

export function assertTwilioSignature(
  request: Request,
  params: Record<string, string>,
): { ok: true } | { ok: false; status: number; body: string } {
  const signature = request.headers.get("x-twilio-signature");
  const { authToken, publicBaseUrl } = getTwilioEnv();

  if (!signature || !authToken || !publicBaseUrl) {
    return { ok: true };
  }

  const url = `${publicBaseUrl}${new URL(request.url).pathname}`;
  const valid = twilio.validateRequest(authToken, signature, url, params);
  if (!valid) {
    return { ok: false, status: 403, body: "Invalid Twilio signature" };
  }
  return { ok: true };
}

export function twiml(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export function emptyTwiml(): Response {
  return twiml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

export function messageTwiml(text: string): Response {
  const escaped = escapeXml(text);
  return twiml(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
  );
}

export function sayTwiml(text: string): Response {
  const escaped = escapeXml(text);
  return twiml(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escaped}</Say><Hangup/></Response>`,
  );
}

/** Speak, then have Twilio SMS the caller as part of the same Voice response. */
export function sayAndSmsTwiml(
  spoken: string,
  sms: string,
  to?: string,
): Response {
  const spokenXml = escapeXml(spoken);
  const smsXml = escapeXml(sms.slice(0, 160));
  const toAttr = to ? ` to="${escapeXml(to)}"` : "";
  return twiml(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${spokenXml}</Say><Sms${toAttr}>${smsXml}</Sms><Hangup/></Response>`,
  );
}

export function dialTwiml(number: string): Response {
  const escaped = escapeXml(number);
  return twiml(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${escaped}</Dial></Response>`,
  );
}

export async function sendSms(to: string, body: string): Promise<string | null> {
  const { accountSid, authToken, phoneNumber } = getTwilioEnv();
  if (!accountSid || !authToken || !phoneNumber || !to) {
    console.warn("sendSms skipped: missing Twilio env or destination", {
      hasAccountSid: Boolean(accountSid),
      hasAuthToken: Boolean(authToken),
      hasFromNumber: Boolean(phoneNumber),
      hasTo: Boolean(to),
    });
    return null;
  }

  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({
    from: phoneNumber,
    to,
    body,
  });
  return message.sid ?? null;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
