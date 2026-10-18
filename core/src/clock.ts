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

// New York date helpers live in nytime.ts (pure, testable); re-exported for existing callers.
export { formatNY, nyWallClock } from "./nytime.js";
