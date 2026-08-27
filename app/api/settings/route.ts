import { hoursLabel, isClosed, statusLabel } from "@/lib/hours";
import {
  getPersistence,
  getSettings,
  type Settings,
  type SettingsUpdate,
  updateSettings,
} from "@/lib/store";
import { getTwilioEnv } from "@/lib/twilio";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await snapshot());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const patch: SettingsUpdate = {};

  if (typeof body.armed === "boolean") patch.armed = body.armed;
  if (typeof body.forceClosed === "boolean") patch.forceClosed = body.forceClosed;
  if (typeof body.forceOpen === "boolean") patch.forceOpen = body.forceOpen;
  if (typeof body.timezone === "string") patch.timezone = body.timezone;
  if (typeof body.openHour === "number") patch.openHour = body.openHour;
  if (typeof body.closeHour === "number") patch.closeHour = body.closeHour;
  if (typeof body.businessName === "string") patch.businessName = body.businessName;
  if (typeof body.closedMessage === "string") patch.closedMessage = body.closedMessage;

  await updateSettings(patch);
  return Response.json(await snapshot());
}

async function snapshot() {
  const settings: Settings = await getSettings();
  const closed = isClosed(settings);
  return {
    ...settings,
    isClosed: closed,
    status: statusLabel(settings, closed),
    hoursLabel: hoursLabel(settings),
    businessNumber: getTwilioEnv().phoneNumber,
    persistence: getPersistence(),
  };
}
