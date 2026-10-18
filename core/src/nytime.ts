// America/New_York (the demo's timezone) date helpers. Pure: callers pass the instant, usually now().

const NY = "America/New_York";
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function nyOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: NY, timeZoneName: "longOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

function nyDate(at: Date): { year: number; month: number; day: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(at).map((x) => [x.type, x.value]),
  );
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
}

/** The instant of hour:minute New York time, dayOffset days after base's New York date. */
export function nyWallClock(base: Date, dayOffset: number, hour: number, minute: number): Date {
  const { year, month, day } = nyDate(base);
  const guess = Date.UTC(year, month - 1, day + dayOffset, hour, minute);
  return new Date(guess - nyOffsetMinutes(new Date(guess)) * MINUTE_MS);
}

/** "Sunday, October 19 at 11:59 PM ET" */
export function formatNY(at: Date): string {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: NY, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(at);
  return `${s} ET`;
}

/** "2026-10-18": the New York calendar date, for once-a-day checks. */
export function nyDateKey(at: Date): string {
  const { year, month, day } = nyDate(at);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "11:59 PM" */
export function formatTimeNY(at: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: NY, hour: "numeric", minute: "2-digit" }).format(at);
}

/** Whole New York calendar days from `from` to `to` (0 = same day, 1 = tomorrow, -1 = yesterday). */
function nyDaysBetween(from: Date, to: Date): number {
  const a = nyDate(from);
  const b = nyDate(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

/** "tonight 11:59 PM", "today 9:00 AM", "tomorrow 5:00 PM", "Tue 9:00 AM", "Oct 30 9:00 AM" */
export function formatWhenNY(target: Date, at: Date): string {
  const days = nyDaysBetween(at, target);
  const time = formatTimeNY(target);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: NY, hour: "numeric", hourCycle: "h23" }).format(target));
  if (days === 0) return `${hour >= 17 ? "tonight" : "today"} ${time}`;
  if (days === 1) return `tomorrow ${time}`;
  if (days > 1 && days < 7) {
    return `${new Intl.DateTimeFormat("en-US", { timeZone: NY, weekday: "short" }).format(target)} ${time}`;
  }
  return `${new Intl.DateTimeFormat("en-US", { timeZone: NY, month: "short", day: "numeric" }).format(target)} ${time}`;
}
