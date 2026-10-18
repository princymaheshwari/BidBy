// Demo clock. now() = real time + settings.clock_offset_minutes.
// This is the only file allowed to read the system clock directly.
import { getSettings, updateSettings } from "./db.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export function now(): Date {
  return new Date(Date.now() + getSettings().clock_offset_minutes * MINUTE_MS);
}

/** Moves the demo clock forward (or back, if negative) and returns the new demo time. */
export function advance(minutes: number): Date {
  updateSettings({ clock_offset_minutes: getSettings().clock_offset_minutes + minutes });
  return now();
}

/** Sets the demo clock to an absolute instant and returns it. */
export function setTo(iso: string): Date {
  const target = Date.parse(iso);
  if (Number.isNaN(target)) throw new Error(`setTo: invalid ISO time "${iso}"`);
  updateSettings({ clock_offset_minutes: (target - Date.now()) / MINUTE_MS });
  return now();
}

/** Hours from now() until iso; negative when iso is in the past. */
export function hoursUntil(iso: string): number {
  return (Date.parse(iso) - now().getTime()) / HOUR_MS;
}

// --- America/New_York helpers (the demo's timezone) ---

const NY = "America/New_York";

function nyOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: NY, timeZoneName: "longOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** The instant of hour:minute New York time, dayOffset days after base's New York date. */
export function nyWallClock(base: Date, dayOffset: number, hour: number, minute: number): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(base).map((x) => [x.type, x.value]),
  );
  const guess = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + dayOffset, hour, minute);
  return new Date(guess - nyOffsetMinutes(new Date(guess)) * MINUTE_MS);
}

/** "Sunday, October 19 at 11:59 PM ET" */
export function formatNY(at: Date): string {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: NY, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(at);
  return `${s} ET`;
}
