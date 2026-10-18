// npm run smoke — the scripted demo run (SYSTEM_DESIGN §13) against a live server, from a cold reset.
// The server must run with VOICE_MODE=mock and MESSAGING_MODE=log (nothing is texted or dialed); the script
// refuses otherwise. Agents are real (OpenClaw Gateway), so a run takes a few minutes.
//   BIDBY_URL=http://127.0.0.1:8797 npm run smoke     (default http://127.0.0.1:8787)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nyWallClock } from "../core/src/nytime.js";

const BASE = process.env.BIDBY_URL ?? "http://127.0.0.1:8787";
const USE_CASE_FIXTURES = new Set(["verification", "card_statement", "card_reminder", "subs_renewal", "scholarship_slack", "reimbursement_travel", "ta_timesheet"]);

interface BidbyEvent { id: string; type: string; payload: Record<string, any>; at: string }
interface Obligation { id: string; title: string; status: string; amount_at_risk_usd: number; snoozed_until: string | null; source_message_ids: string[] }

// --- HTTP + event stream ---

async function api<T = any>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${JSON.stringify(data)}`);
  return data as T;
}

const events: BidbyEvent[] = [];
const seen = new Set<string>();

/** Follows GET /api/events for the whole run (the replayed backlog is skipped by `since`). */
async function followEvents(): Promise<void> {
  const res = await fetch(`${BASE}/api/events`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data) continue;
      const e = JSON.parse(data) as BidbyEvent;
      if (!seen.has(e.id)) { seen.add(e.id); events.push(e); }
    }
  }
}

async function waitFor<T>(what: string, check: () => T | undefined | Promise<T | undefined>, timeoutMs = 180_000): Promise<T> {
  const until = performance.now() + timeoutMs;
  while (performance.now() < until) {
    const v = await check();
    if (v !== undefined && v !== false) return v;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const after = (mark: number) => events.slice(mark);
const event = (mark: number, type: string, match: (p: Record<string, any>) => boolean = () => true) =>
  after(mark).find((e) => e.type === type && match(e.payload));

// --- checks ---

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
const step = (n: number, text: string) => console.log(`\n[${n}] ${text}`);
const money = (v: number) => `$${v.toLocaleString("en-US")}`;

async function main(): Promise<void> {
  const state0 = await api("GET", "/api/demo/state").catch((err: Error) => {
    throw new Error(`no BidBy server at ${BASE} (${err.message})`);
  });
  if (state0.voice_mode !== "mock" || state0.messaging_mode !== "log") {
    throw new Error(`refusing to run: the server has VOICE_MODE=${state0.voice_mode}, MESSAGING_MODE=${state0.messaging_mode}; ` +
      "start it with VOICE_MODE=mock MESSAGING_MODE=log (a scratch DB_PATH is a good idea too)");
  }
  void followEvents().catch((err) => console.error(`event stream: ${err.message}`));
  await new Promise((r) => setTimeout(r, 500));

  step(1, "Reset and load the inbox");
  let mark = events.length;
  await api("POST", "/api/demo/reset");
  const obs = await api<Obligation[]>("GET", "/api/obligations");
  const open = obs.filter((o) => !["done", "dismissed"].includes(o.status));
  check("at least 5 open obligations", open.length >= 5, `${open.length}`);
  const fixtureOf = new Map(after(mark).filter((e) => e.type === "message.received").map((e) => [e.payload.raw_message_id, e.payload.fixture_id]));
  const fromNoise = obs.filter((o) => o.source_message_ids.some((m) => !USE_CASE_FIXTURES.has(fixtureOf.get(m))));
  check("no obligation from a noise message", fromNoise.length === 0, fromNoise.map((o) => o.title).join(", "));
  const noise = JSON.parse(readFileSync(resolve(import.meta.dirname, "../fixtures/inbox.json"), "utf8")).length - USE_CASE_FIXTURES.size;
  console.log(`  (${obs.length} obligations from ${fixtureOf.size} messages, ${noise} of them noise)`);

  step(2, "FAFSA verification (buried in the inbox) ranks first and is texted");
  const vmsg = [...fixtureOf].find(([, f]) => f === "verification")?.[0];
  const vid: string = obs.find((o) => vmsg && o.source_message_ids.includes(vmsg))?.id ?? "";
  check("verification became an obligation", !!vid, vid);
  const top = await waitFor("a ranking round with the verification", () =>
    event(mark, "decision.made", (p) => p.ranked_ids.includes(vid))?.payload);
  check("verification ranks #1", top.ranked_ids[0] === vid, `${top.top_title}, score ${Math.round(top.top_score)}`);
  await waitFor("the interrupt text", () => event(mark, "obligation.notified", (p) => p.id === vid));
  const interrupt = event(mark, "text.sent", (p) => p.kind === "interrupt" && p.obligation_id === vid);
  check("notify: interrupt text sent", !!interrupt, interrupt?.payload.body.split("\n")[0]);
  check("interrupt says where the documents are", /Your documents are in /.test(interrupt?.payload.body ?? ""));

  step(3, "Reply 1");
  mark = events.length;
  await api("POST", "/api/demo/reply", { text: "1" });
  const draft = await waitFor("the draft", () => event(mark, "text.sent", (p) => p.kind === "reply" && p.obligation_id === vid));
  check("draft sent", draft.payload.body.startsWith("Draft for"), draft.payload.body.split("\n")[0]);

  step(3.5, "Reply send");
  mark = events.length;
  await api("POST", "/api/demo/reply", { text: "send" });
  const outcome = await waitFor("an email outcome", () =>
    after(mark).find((e) => ["email.sent", "email.refused", "email.failed"].includes(e.type)));
  check("send handled (sent, or refused by the allowlist)", outcome.type !== "email.failed", `${outcome.type} ${outcome.payload.to ?? ""}`);

  step(4, "Jump to 9 PM: BidBy calls (mock), then 'snooze 10pm'");
  mark = events.length;
  const nine = nyWallClock(new Date((await api("GET", "/api/demo/state")).now), 0, 21, 0); // reset put the clock back to real time
  await api("POST", "/api/demo/clock", { set_iso: nine.toISOString() });
  const started = await waitFor("call.started", () => event(mark, "call.started", (p) => p.obligation_id === vid));
  check("call started with the mock conversation id", started.payload.conversation_id === `conv_mock_${vid}`, started.payload.conversation_id);
  await api("POST", `/api/demo/calls/conv_mock_${vid}/complete`, { outcome: "completed", say: "snooze 10pm" });
  const snoozed = (await api<Obligation[]>("GET", "/api/obligations")).find((o) => o.id === vid)!;
  const tenPm = nyWallClock(nine, 0, 22, 0).toISOString();
  check("item snoozed until 10 PM demo time", snoozed.status === "snoozed" && snoozed.snoozed_until === tenPm, `${snoozed.status} ${snoozed.snoozed_until}`);
  const completed = await waitFor("call.completed", () => event(mark, "call.completed", (p) => p.obligation_id === vid));
  check("call completed", completed.payload.status === "completed");
  check("snooze_obligation tool event", !!event(mark, "voice.tool_called", (p) => p.tool === "snooze_obligation"));

  step(5, "Inject the confirmation");
  const before = (await api("GET", "/api/demo/state")).protected_total as number;
  const confirmed = await api("POST", "/api/demo/inject", { fixture_id: "verification_confirmed" });
  const done = (await api<Obligation[]>("GET", "/api/obligations")).find((o) => o.id === vid)!;
  check("verification done", done.status === "done" && confirmed.completed_ids.includes(vid), done.status);
  const afterTotal = (await api("GET", "/api/demo/state")).protected_total as number;
  check("protected total up by $3,700", Math.round((afterTotal - before) * 100) === 370_000, `${money(before)} → ${money(afterTotal)}`);
}

const t0 = performance.now();
try {
  await main();
} catch (err) {
  failures++;
  console.error(`\n✗ ${(err as Error).message}`);
}
console.log(`\n${failures === 0 ? "SMOKE PASSED" : `SMOKE FAILED (${failures})`} in ${Math.round((performance.now() - t0) / 1000)} s`);
process.exit(failures === 0 ? 0 : 1);
