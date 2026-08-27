import type { Settings } from "./store";

export function hourInTimezone(now: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone,
  }).format(now);
  const hour = Number.parseInt(formatted, 10);
  return Number.isNaN(hour) ? now.getHours() : hour;
}

export function outsideBusinessHours(settings: Settings, now = new Date()): boolean {
  const hour = hourInTimezone(now, settings.timezone);
  return hour < settings.openHour || hour >= settings.closeHour;
}

/**
 * Closed sign is showing: armed + (forced closed, or auto hours), unless forced open.
 * Disarmed always behaves as open (calls ring the owner, no auto-reply).
 */
export function isClosed(settings: Settings, now = new Date()): boolean {
  if (!settings.armed) {
    return false;
  }
  if (settings.forceClosed) {
    return true;
  }
  if (settings.forceOpen) {
    return false;
  }
  return outsideBusinessHours(settings, now);
}

export function formatHour(hour: number): string {
  const period = hour >= 12 ? "pm" : "am";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${period}`;
}

export function hoursLabel(settings: Settings): string {
  return `${formatHour(settings.openHour)}–${formatHour(settings.closeHour)}`;
}

export function statusLabel(settings: Settings, closed: boolean): string {
  if (!settings.armed) {
    return "Disarmed";
  }
  if (closed) {
    return "After hours";
  }
  return settings.forceOpen ? "Open now" : "Open";
}
