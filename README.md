# Closed Sign

A second number for a shop that is closed. Texts get an instant reply. Calls do not die in voicemail — the caller hears a short message and gets an SMS on the same thread. The dashboard is the live status surface: armed, hours, lead log.

Hackathon demo. Twilio trial + verified phones. No 10DLC, no iOS app, no database.

Repo: [maxhum-sudo/CursorCallForward](https://github.com/maxhum-sudo/CursorCallForward)

## Demo (90 seconds)

1. Dashboard shows **ARMED · After hours · Ace Plumbing**.
2. Text the Twilio number. Auto-reply arrives. The log updates in about a second.
3. Call the number. Hear “We're closed. We'll text you now.” SMS lands on the same thread.
4. Tap **Open now**. The next call rings `OWNER_PHONE`.

Use **After hours** so the demo works at 2pm.

## Setup

```bash
git clone https://github.com/maxhum-sudo/CursorCallForward.git
cd CursorCallForward
cp .env.example .env.local
npm install
npm run dev
```

Fill `.env.local` (E.164 numbers, no trailing slash on the public URL):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
OWNER_PHONE=+15557654321
PUBLIC_BASE_URL=https://YOUR-SUBDOMAIN.ngrok-free.app
```

In another terminal, expose port 3000:

```bash
ngrok http 3000
```

Cloudflare Tunnel works too (`cloudflared tunnel --url http://localhost:3000`). Copy the `https://` origin into `PUBLIC_BASE_URL` and restart `npm run dev` so the Twilio signature check uses the same host.

### Twilio number webhooks

In [Twilio Console → Phone Numbers → Active Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming) → your number:

| Section | Field | Value |
|---|---|---|
| Voice | A call comes in | `POST {PUBLIC_BASE_URL}/api/twilio/voice` |
| Messaging | A message comes in | `POST {PUBLIC_BASE_URL}/api/twilio/sms` |

Messaging and Voice are separate. Putting the SMS URL only under Voice will silently drop texts.

If ngrok restarts, the host changes. Update **both** webhook fields **and** `PUBLIC_BASE_URL`.

## Trial checklist (do this before the demo, not on stage)

- Verify every phone that will text or call: Twilio Console → Phone Numbers → Verified Caller IDs (trial cannot reach unverified numbers).
- Confirm `OWNER_PHONE` is verified if you will demo **Open now**.
- Send a test SMS from a verified phone with **After hours** armed. Confirm TwiML reply + dashboard row.
- Place a test call. Confirm `<Say>` + inbound SMS.
- If SMS fails with **21608** or **30034**, it is trial/geo — not app code. Use verified numbers only.
- Signature 403s usually mean `PUBLIC_BASE_URL` does not match the URL Twilio posted (trailing slash, http vs https, stale ngrok host).

## Routes

- `GET /` — dashboard
- `POST /api/twilio/sms` — inbound SMS auto-reply when closed
- `POST /api/twilio/voice` — closed: say + SMS; open: dial owner
- `GET /api/events` — recent log (last 50)
- `GET` / `POST /api/settings` — armed, force closed/open, hours, copy

## Shared store (required for Vercel)

Settings, the lead log, and Twilio SID idempotency use **Upstash Redis** when these env vars are set:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Create a database: [Vercel Marketplace → Upstash](https://vercel.com/marketplace/upstash) or [console.upstash.com](https://console.upstash.com). Copy the REST URL and token into `.env.local` (and later into Vercel env).

Without those vars the app falls back to in-memory storage. That is fine for `next dev` + ngrok. It will **not** share state across Vercel serverless instances — the dashboard footer will say `memory`.

With Redis it says `Upstash Redis`. Toggles and incoming tickets survive deploys and multiple functions.

## Out of scope

10DLC, CallKit, auth, multi-tenant, missed-call Dial callbacks, AI replies.
