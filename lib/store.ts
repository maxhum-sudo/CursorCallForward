import { Redis } from "@upstash/redis";

export type Settings = {
  armed: boolean;
  forceClosed: boolean;
  forceOpen: boolean;
  timezone: string;
  openHour: number;
  closeHour: number;
  businessName: string;
  closedMessage: string;
};

export type EventChannel = "sms" | "voice";
export type EventKind =
  | "inbound"
  | "auto-reply"
  | "call-closed"
  | "call-open";

export type EventItem = {
  id: string;
  sid: string;
  at: string;
  channel: EventChannel;
  direction: "in" | "out";
  from: string;
  to: string;
  snippet: string;
  kind: EventKind;
};

export type SettingsUpdate = Partial<Settings>;

export type Persistence = "redis" | "memory";

const MAX_EVENTS = 50;
const SETTINGS_KEY = "closed-sign:settings";
const EVENTS_KEY = "closed-sign:events";
const SID_PREFIX = "closed-sign:sid:";
const SID_TTL_SECONDS = 60 * 60 * 24;

const DEFAULT_SETTINGS: Settings = {
  armed: true,
  forceClosed: true,
  forceOpen: false,
  timezone: "America/Denver",
  openHour: 8,
  closeHour: 17,
  businessName: "Ace Plumbing",
  closedMessage:
    "Ace Plumbing is closed (back 8am). Reply with the address and what's broken — we'll text you first thing.",
};

type MemoryState = {
  settings: Settings;
  events: EventItem[];
  processedSids: Set<string>;
};

const globalForStore = globalThis as unknown as {
  __closedSign?: MemoryState;
  __closedSignRedis?: Redis | null;
};

function memory(): MemoryState {
  if (!globalForStore.__closedSign) {
    globalForStore.__closedSign = {
      settings: { ...DEFAULT_SETTINGS },
      events: [],
      processedSids: new Set<string>(),
    };
  }
  return globalForStore.__closedSign;
}

function redisClient(): Redis | null {
  if (globalForStore.__closedSignRedis !== undefined) {
    return globalForStore.__closedSignRedis;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  globalForStore.__closedSignRedis =
    url && token ? new Redis({ url, token }) : null;
  return globalForStore.__closedSignRedis;
}

export function getPersistence(): Persistence {
  return redisClient() ? "redis" : "memory";
}

export async function getSettings(): Promise<Settings> {
  const redis = redisClient();
  if (!redis) {
    return { ...memory().settings };
  }
  const stored = await redis.get<Settings>(SETTINGS_KEY);
  return stored ? mergeSettings(stored) : { ...DEFAULT_SETTINGS };
}

export async function updateSettings(patch: SettingsUpdate): Promise<Settings> {
  const current = await getSettings();
  const next = applyPatch(current, patch);
  const redis = redisClient();
  if (redis) {
    await redis.set(SETTINGS_KEY, next);
  } else {
    memory().settings = next;
  }
  return { ...next };
}

export async function getEvents(): Promise<EventItem[]> {
  const redis = redisClient();
  if (!redis) {
    return [...memory().events];
  }
  const rows = await redis.lrange<EventItem>(EVENTS_KEY, 0, MAX_EVENTS - 1);
  return Array.isArray(rows) ? rows : [];
}

export async function addEvent(
  event: Omit<EventItem, "id" | "at"> & { at?: string },
): Promise<EventItem> {
  const item: EventItem = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: event.at ?? new Date().toISOString(),
  };
  const redis = redisClient();
  if (redis) {
    await redis.lpush(EVENTS_KEY, item);
    await redis.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  } else {
    const current = memory();
    current.events.unshift(item);
    if (current.events.length > MAX_EVENTS) {
      current.events.length = MAX_EVENTS;
    }
  }
  return item;
}

/** Returns true if this SID is new and claimed; false if Twilio is retrying. */
export async function claimSid(sid: string | undefined | null): Promise<boolean> {
  if (!sid) {
    return true;
  }
  const redis = redisClient();
  if (redis) {
    const created = await redis.set(`${SID_PREFIX}${sid}`, "1", {
      nx: true,
      ex: SID_TTL_SECONDS,
    });
    return Boolean(created);
  }
  const current = memory();
  if (current.processedSids.has(sid)) {
    return false;
  }
  current.processedSids.add(sid);
  return true;
}

function applyPatch(current: Settings, patch: SettingsUpdate): Settings {
  const next: Settings = { ...current, ...patch };

  if (patch.forceClosed === true) {
    next.forceOpen = false;
  }
  if (patch.forceOpen === true) {
    next.forceClosed = false;
  }

  next.openHour = clampHour(next.openHour);
  next.closeHour = clampHour(next.closeHour);
  return next;
}

function mergeSettings(stored: Settings): Settings {
  return applyPatch({ ...DEFAULT_SETTINGS }, stored);
}

function clampHour(hour: number): number {
  if (Number.isNaN(hour)) return 0;
  return Math.min(23, Math.max(0, Math.round(hour)));
}
