"use client";

import { useCallback, useEffect, useState } from "react";
import { formatHour } from "@/lib/hours";
import type { EventItem, Persistence, Settings } from "@/lib/store";

type Snapshot = Settings & {
  isClosed: boolean;
  status: string;
  hoursLabel: string;
  businessNumber: string;
  persistence?: Persistence;
};

const TIMEZONES = [
  "America/Denver",
  "America/Los_Angeles",
  "America/Chicago",
  "America/New_York",
];

export function Dashboard() {
  const [settings, setSettings] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [settingsRes, eventsRes] = await Promise.all([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/events", { cache: "no-store" }),
      ]);
      if (!settingsRes.ok || !eventsRes.ok) {
        throw new Error("Failed to load");
      }
      const nextSettings = (await settingsRes.json()) as Snapshot;
      const nextEvents = (await eventsRes.json()) as { events: EventItem[] };
      setSettings(nextSettings);
      setEvents(nextEvents.events);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error("Could not save");
      }
      setSettings((await res.json()) as Snapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="americana-stage flex min-h-full flex-1 items-center justify-center px-5">
        <p className="warm-tubes">{error ?? "WARMING"}</p>
      </div>
    );
  }

  const inbound = events.find((event) => event.direction === "in");
  const closed = settings.isClosed;
  const armed = settings.armed;
  const live =
    inbound !== undefined &&
    Date.now() - new Date(inbound.at).getTime() < 30_000;
  const signClass = !armed ? "is-off" : closed ? "is-closed" : "is-open";

  return (
    <div className="americana-stage min-h-full flex-1">
      <Starburst className="ornament top-6 left-[4%] hidden w-16 sm:block" />
      <Starburst className="ornament top-10 right-[6%] hidden w-12 sm:block" />
      <Boomerang className="ornament right-[8%] bottom-24 hidden w-24 sm:block" />

      <div className="americana-unit mx-auto flex w-full max-w-[42rem] flex-col gap-5 px-4 py-8 sm:px-5">
        <header className="marquee">
          <span className="rivet rivet-tl" />
          <span className="rivet rivet-tr" />
          <span className="rivet rivet-bl" />
          <span className="rivet rivet-br" />
          <div className="marquee-inner">
            <div>
              <p className="wordmark">CLOSED SIGN</p>
              <p className="nite-badge">NITE LINE</p>
              <p className="script-line mt-2">
                the number that answers when you can&apos;t
              </p>
            </div>
            <div>
              <p className="line-number">{formatPhone(settings.businessNumber)}</p>
              <p className="line-caption">HOOKED LINE</p>
            </div>
          </div>
        </header>

        <section className="sign-rig">
          <div className="sign-chains" aria-hidden>
            <span />
            <span />
          </div>
          <div className="sign-canopy">
            <p>{settings.businessName || "THE SHOP"}</p>
          </div>
          <div
            className={`sign-housing ${signClass}`}
            aria-label={`${settings.businessName}, ${closed ? "closed" : "open"}, ${settings.status}, ${settings.hoursLabel}`}
          >
            <div className="sign-glass" />
            <div className="neon-stack" aria-hidden>
              <p
                className={`neon-word open ${armed && !closed ? "is-lit-mint" : "is-dead"}`}
              >
                OPEN
              </p>
              <p
                className={`neon-word closed ${armed && closed ? "is-lit-red" : "is-dead"}`}
              >
                CLOSED
              </p>
            </div>
            <div className="lamp-row">
              <span className="lamp">
                <span className={`jewel ${armed ? "is-amber" : ""}`} />
                ARMED
              </span>
              <span className="lamp">
                <span
                  className={`jewel ${armed && closed ? "is-red" : armed ? "is-mint" : ""}`}
                />
                {settings.status.toUpperCase()}
              </span>
              <span className="lamp">
                <span className={`jewel ${live ? "is-red is-live" : saving ? "is-amber" : "is-cyan"}`} />
                {live ? "LIVE" : saving ? "REC" : "LINE"}
              </span>
            </div>
            <p className="sign-hours mt-3">
              {formatHour(settings.openHour).toUpperCase()}
              <span className="mx-2 text-chrome/40">——</span>
              {formatHour(settings.closeHour).toUpperCase()}
            </p>
            <p className="sign-ticker">
              {inbound
                ? `LAST IN · ${inbound.channel.toUpperCase()} · ${inbound.from} · ${inbound.snippet}`
                : "LINE QUIET · WAITING ON A RING"}
            </p>
          </div>
        </section>

        {error ? <p className="fault">FAULT · {error}</p> : null}

        <section className="chassis">
          <span className="rivet rivet-tl" />
          <span className="rivet rivet-tr" />
          <span className="rivet rivet-bl" />
          <span className="rivet rivet-br" />
          <h2 className="chassis-stamp">MODE SELECT</h2>
          <div className="mode-bank">
            <ModeButton
              active={settings.armed}
              tone="amber"
              label="Armed"
              hint="Master"
              onClick={() => patch({ armed: !settings.armed })}
              disabled={saving}
            />
            <ModeButton
              active={settings.armed && settings.forceClosed}
              tone="red"
              label="After hours"
              hint="Demo"
              onClick={() => patch({ forceClosed: true, armed: true })}
              disabled={saving}
            />
            <ModeButton
              active={settings.armed && settings.forceOpen}
              tone="mint"
              label="Open now"
              hint="Ring cell"
              onClick={() => patch({ forceOpen: true, armed: true })}
              disabled={saving}
            />
          </div>
        </section>

        <section className="chassis">
          <span className="rivet rivet-tl" />
          <span className="rivet rivet-tr" />
          <span className="rivet rivet-bl" />
          <span className="rivet rivet-br" />
          <h2 className="chassis-stamp">SHOP CONTROLS</h2>
          <div className="flex flex-col gap-3">
            <label>
              <span className="field-label">Shop name</span>
              <input
                className="chrome-well"
                defaultValue={settings.businessName}
                key={settings.businessName}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value && value !== settings.businessName) {
                    void patch({ businessName: value });
                  }
                }}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label>
                <span className="field-label">Open</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="chrome-well"
                  defaultValue={settings.openHour}
                  key={`open-${settings.openHour}`}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isNaN(value) && value !== settings.openHour) {
                      void patch({ openHour: value });
                    }
                  }}
                />
              </label>
              <label>
                <span className="field-label">Close</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="chrome-well"
                  defaultValue={settings.closeHour}
                  key={`close-${settings.closeHour}`}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isNaN(value) && value !== settings.closeHour) {
                      void patch({ closeHour: value });
                    }
                  }}
                />
              </label>
              <label>
                <span className="field-label">Timezone</span>
                <select
                  className="chrome-well"
                  value={settings.timezone}
                  onChange={(event) => patch({ timezone: event.target.value })}
                >
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace("America/", "").replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span className="field-label">Closed reply</span>
              <textarea
                rows={3}
                className="chrome-well"
                defaultValue={settings.closedMessage}
                key={settings.closedMessage}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value && value !== settings.closedMessage) {
                    void patch({ closedMessage: value });
                  }
                }}
              />
            </label>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-end justify-between gap-3 px-1">
            <h2 className="text-[0.68rem] font-semibold tracking-[0.32em] text-gold">
              INCOMING TICKETS
            </h2>
            <p className="font-gauge text-xs tracking-widest text-chrome/50">
              POLLS · 1 SEC
            </p>
          </div>
          <div className="hopper-lip" />
          <ol className="ticket-stack">
            {events.length === 0 ? (
              <li className="ticket is-empty">Waiting for a text or call…</li>
            ) : (
              events.map((event) => (
                <li key={event.id} className="ticket">
                  <div className="ticket-head">
                    <span
                      className={`ticket-stamp ${event.direction === "out" ? "is-out" : ""}`}
                    >
                      {event.channel} · {event.kind} · {event.direction}
                    </span>
                    <time className="ticket-time" dateTime={event.at}>
                      {formatTime(event.at)}
                    </time>
                  </div>
                  <p className="ticket-route">
                    {event.from} → {event.to}
                  </p>
                  <p className="ticket-body">{event.snippet}</p>
                </li>
              ))
            )}
          </ol>
        </section>

        <footer className="menu-card mb-4">
          <p className="menu-kicker">TODAY&apos;S SPECIAL</p>
          <p className="menu-title">DEMO · 90 SECONDS</p>
          <ol>
            <li>Leave After hours armed. The sign reads CLOSED.</li>
            <li>Text the number. Reply lands on the phone; a ticket prints.</li>
            <li>Call. Hear “we&apos;ll text you now.” Same thread, SMS arrives.</li>
            <li>Tap Open now. Next call rings OWNER_PHONE.</li>
          </ol>
          <p className="menu-note">
            Trial accounts only reach Twilio-verified numbers. Store:{" "}
            {settings.persistence === "redis"
              ? "Upstash Redis (shared — OK for Vercel)"
              : "memory (local only — add UPSTASH_REDIS_REST_URL for Vercel)"}.
            See README.
          </p>
        </footer>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  tone,
  label,
  hint,
  onClick,
  disabled,
}: {
  active: boolean;
  tone: "amber" | "red" | "mint";
  label: string;
  hint: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`mode-key is-${tone} ${active ? "is-on" : ""}`}
    >
      <span className="mode-key-lens">
        <span className="mode-key-label">{label.toUpperCase()}</span>
        <span className="mode-key-hint">{hint.toUpperCase()}</span>
      </span>
    </button>
  );
}

function Starburst({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <polygon points="32,0 35,26 32,32 29,26" />
      <polygon points="32,64 35,38 32,32 29,38" />
      <polygon points="0,32 26,29 32,32 26,35" />
      <polygon points="64,32 38,29 32,32 38,35" />
      <polygon points="10,10 28,28 32,32 28,26" />
      <polygon points="54,10 36,28 32,32 38,26" />
      <polygon points="10,54 28,36 32,32 26,38" />
      <polygon points="54,54 36,36 32,32 38,38" />
      <circle cx="32" cy="32" r="4.5" />
    </svg>
  );
}

function Boomerang({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 48"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path d="M8 38 C 28 8, 58 4, 78 18 C 92 28, 108 22, 114 10" />
      <path d="M14 42 C 34 14, 62 10, 80 22" opacity="0.45" />
    </svg>
  );
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    return value || "NO LINE";
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
