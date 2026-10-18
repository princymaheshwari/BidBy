// Hono app and routes; starts the tick loop and the Spectrum loop.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { advance, now, setTo } from "./clock.js";
import { config } from "./config.js";
import { clearAll, db, getSettings, newId } from "./db.js";
import { startTimer, tick } from "./escalation/timer.js";
import { emit, eventsStream } from "./events.js";
import { findFixture, loadHeld, loadInbox, renderFixture, type Fixture } from "./fixtures.js";
import { handleReply } from "./messaging/replies.js";
import { startSpectrum } from "./messaging/spectrum.js";
import { ingest } from "./pipeline/ingest.js";
import { dismiss, getMessages, getObligation, getOpen, listObligations, markDone, protectedTotal, snooze } from "./pipeline/ledger.js";
import { latestDecision, latestScores, rank } from "./pipeline/rank.js";
import { completeMockCall } from "./voice/calls.js";
import { startCall } from "./voice/elevenlabs.js";
import { tunnelGuard, voice } from "./voice/routes.js";

const INDEX_HTML = resolve(import.meta.dirname, "../public/index.html");
const INTAKE_HTML = resolve(import.meta.dirname, "../public/intake.html");
const HOUR_MS = 3_600_000;
const DEFAULT_SNOOZE_HOURS = 2;

const app = new Hono();

app.use("*", tunnelGuard); // through the tunnel, only /voice/* answers
app.route("/voice", voice);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

// Read on each request so edits to the page show up without a restart.
app.get("/", (c) => c.html(readFileSync(INDEX_HTML, "utf8")));
app.get("/intake", (c) => c.html(readFileSync(INTAKE_HTML, "utf8")));

app.get("/api/events", (c) => eventsStream(c));

// --- ingest + ledger ---

const IngestBody = z.object({
  source: z.enum(["email", "slack", "bank", "calendar"]),
  sender: z.string(),
  subject: z.string(),
  body: z.string(),
  received_at: z.string().datetime({ offset: true }),
});

app.post("/api/ingest", async (c) => {
  const body = IngestBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {source, sender, subject, body, received_at}" }, 400);
  return c.json(await ingest(body.data));
});

app.get("/api/obligations", (c) => {
  const scores = latestScores();
  return c.json(listObligations().map((o) => ({ ...o, score: scores[o.id] ?? null })));
});

// --- ranking ---

app.post("/api/rank", async (c) => c.json(await rank()));

app.get("/api/decisions/latest", (c) => c.json(latestDecision()));

const ActionBody = z.object({
  action: z.enum(["done", "snooze", "dismiss"]),
  until: z.string().datetime({ offset: true }).optional(),
});

app.post("/api/obligations/:id/action", async (c) => {
  const body = ActionBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'body must be {action: "done" | "snooze" | "dismiss", until?}' }, 400);
  const id = c.req.param("id");
  if (!getObligation(id)) return c.json({ error: `unknown obligation "${id}"` }, 404);

  const { action, until } = body.data;
  if (action === "done") markDone(id, "api");
  else if (action === "dismiss") dismiss(id);
  else snooze(id, until ?? new Date(now().getTime() + DEFAULT_SNOOZE_HOURS * HOUR_MS).toISOString());
  return c.json(getObligation(id));
});

// --- demo controls ---

const ClockBody = z.union([
  z.object({ advance_minutes: z.number() }),
  z.object({ set_iso: z.string().datetime({ offset: true }) }),
]);

app.post("/api/demo/clock", async (c) => {
  const body = ClockBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {advance_minutes} or {set_iso}" }, 400);

  const t = "advance_minutes" in body.data ? advance(body.data.advance_minutes) : setTo(body.data.set_iso);
  emit("clock.changed", { now: t.toISOString(), offset_minutes: getSettings().clock_offset_minutes });
  void tick(); // immediate tick so "Jump to 9 PM" has visible effects (it may rank, so don't wait for it)
  return c.json({ now: t.toISOString() });
});

let resetting = false;
const RESET_CONCURRENCY = 8; // extractor sessions in flight at once during a reset

// Clears state, ingests the seeded inbox (every received_at is in the past), then ranks once.
// Senders run in parallel; one sender's messages stay in received order, so a reminder sees the
// statement it merges into.
app.post("/api/demo/reset", async (c) => {
  if (resetting) return c.json({ error: "a reset is already running" }, 409);
  resetting = true;
  try {
    clearAll();
    emit("demo.reset", { now: now().toISOString() });
    const base = now();
    const inbox = loadInbox().sort((a, b) => a.received_at_offset_hours - b.received_at_offset_hours);
    const bySender = new Map<string, Fixture[]>();
    for (const f of inbox) bySender.set(f.sender, [...(bySender.get(f.sender) ?? []), f]);
    const queue = [...bySender.values()];
    await Promise.all(Array.from({ length: RESET_CONCURRENCY }, async () => {
      for (let group = queue.shift(); group; group = queue.shift()) {
        for (const f of group) await ingest(renderFixture(f, base), { fixture_id: f.id, rank: false });
      }
    }));
    emit("demo.seeded", { messages: inbox.length, open_obligations: getOpen().length });
    await rank();
    return c.json({ ok: true });
  } finally {
    resetting = false;
  }
});

// Empties the ledger without reading the inbox: the intake page's "before" state (demo act 1).
app.post("/api/demo/clear", (c) => {
  if (resetting) return c.json({ error: "a reset is already running" }, 409);
  clearAll();
  emit("demo.reset", { now: now().toISOString(), cleared: true });
  return c.json({ ok: true });
});

const InjectBody = z.object({ fixture_id: z.string() });

app.post("/api/demo/inject", async (c) => {
  const body = InjectBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {fixture_id}" }, 400);

  const fixture = findFixture(body.data.fixture_id);
  if (!fixture) return c.json({ error: `unknown fixture "${body.data.fixture_id}"` }, 404);
  return c.json(await ingest(renderFixture(fixture, now()), { fixture_id: fixture.id }));
});

// --- judge view state (local only) ---

const WEEK_MS = 7 * 24 * HOUR_MS;

/** Demo clock, headline totals and the held fixtures for "Inject next" (injected = since the last reset). */
app.get("/api/demo/state", (c) => {
  const at = now();
  const atRiskWeek = getOpen()
    .filter((o) => { const t = Date.parse(o.deadline_at); return t >= at.getTime() && t <= at.getTime() + WEEK_MS; })
    .reduce((sum, o) => sum + o.amount_at_risk_usd, 0);
  const lastReset = db.prepare("SELECT rowid FROM events WHERE type = 'demo.reset' ORDER BY rowid DESC LIMIT 1").get() as
    { rowid: number } | undefined;
  const injected = new Set((db.prepare(
    `SELECT json_extract(payload, '$.fixture_id') AS id FROM events
     WHERE type = 'message.received' AND rowid > ? AND json_extract(payload, '$.fixture_id') IS NOT NULL`,
  ).all(lastReset?.rowid ?? 0) as { id: string }[]).map((r) => r.id));
  return c.json({
    now: at.toISOString(),
    offset_minutes: getSettings().clock_offset_minutes,
    at_risk_week: Math.round(atRiskWeek * 100) / 100,
    protected_total: protectedTotal(),
    voice_mode: config.VOICE_MODE,
    messaging_mode: config.MESSAGING_MODE,
    held: loadHeld().map((f) => ({ id: f.id, subject: f.subject, injected: injected.has(f.id) })),
  });
});

type IntakeStatus = "waiting" | "reading" | "noise" | "flagged" | "unprocessed" | "obligation" | "merged" | "confirmation" | "no_action";
const BID_AGENTS = ["aid", "credit", "subs", "money_in"] as const;

/**
 * Intake page state since the last reset: every inbox message (stored ones, plus seeded fixtures not read yet),
 * what the extractor made of each, and each domain agent's bidding state. Derived from events.
 */
app.get("/api/demo/intake", (c) => {
  const reset = db.prepare("SELECT rowid, payload FROM events WHERE type = 'demo.reset' ORDER BY rowid DESC LIMIT 1").get() as
    { rowid: number; payload: string } | undefined;
  const base = reset ? new Date(JSON.parse(reset.payload).now) : now();
  const events = (db.prepare("SELECT type, payload, at FROM events WHERE rowid > ? ORDER BY rowid").all(reset?.rowid ?? 0) as
    { type: string; payload: string; at: string }[]).map((e) => ({ type: e.type, p: JSON.parse(e.payload), at: e.at }));
  const domainOf = new Map(listObligations().map((o) => [o.id, o.domain]));

  type Read = { fixture_id: string | null; status: IntakeStatus; obligation_ids: string[] };
  const read = new Map<string, Read>();
  type AgentState = "idle" | "bidding" | "bid" | "failed" | "starting" | "texted";
  const agents: Record<string, AgentState> = Object.fromEntries(BID_AGENTS.map((a) => [a, "idle"]));
  // The iMessage thread and emails since the reset, for the page's phone panel.
  const thread: { from: "bidby" | "you" | "email"; kind: string; text: string; at: string }[] = [];
  let seeded = false, ranked = false;
  for (const { type, p, at } of events) {
    const r = read.get(p.raw_message_id);
    switch (type) {
      case "message.received": read.set(p.raw_message_id, { fixture_id: p.fixture_id ?? null, status: "reading", obligation_ids: [] }); break;
      case "message.noise": if (r) r.status = "noise"; break;
      case "message.flagged": if (r) r.status = "flagged"; break;
      case "message.unprocessed": if (r) r.status = "unprocessed"; break;
      case "obligation.created": if (r) r.obligation_ids.push(p.id); break;
      case "obligation.updated": if (r) { r.obligation_ids.push(p.id); r.status = "merged"; } break;
      case "message.extracted":
        if (r && r.status !== "merged") {
          r.status = p.obligation_ids.length ? "obligation" : p.completed_ids.length ? "confirmation" : "no_action";
        }
        break;
      case "agent.called":
        // "texted" sticks: later ranking rounds don't hide that this agent's item reached the phone.
        if (p.agent_id in agents && p.tool === "submit_bids" && agents[p.agent_id] !== "texted") agents[p.agent_id] = "bidding";
        if (p.agent_id in agents && p.tool === "write_head_start") agents[p.agent_id] = "starting";
        break;
      case "text.sent": {
        thread.push({ from: "bidby", kind: p.kind, text: p.body, at });
        const d = domainOf.get(p.obligation_id);
        if (p.kind === "interrupt" && d && d in agents) agents[d] = "texted";
        break;
      }
      case "text.received": thread.push({ from: "you", kind: "reply", text: p.text, at }); break;
      case "email.sent": thread.push({ from: "email", kind: "sent", text: `Emailed ${p.to}: “${p.subject}”`, at }); break;
      case "agent.returned":
        if (p.agent_id in agents && agents[p.agent_id] !== "texted" && p.ok && ["submit_bids", "write_head_start"].includes(p.tool)) agents[p.agent_id] = "bid";
        break;
      case "agent.failed": if (p.tool === "submit_bids" && p.agent_id in agents && agents[p.agent_id] !== "texted") agents[p.agent_id] = "failed"; break;
      case "demo.seeded": seeded = true; break;
      case "decision.made": ranked = true; break;
    }
  }

  const stored = getMessages([...read.keys()]).map((m) => ({ ...m, raw_message_id: m.id, ...read.get(m.id)! }));
  const readFixtures = new Set(stored.map((m) => m.fixture_id));
  const waiting = loadInbox().filter((f) => !readFixtures.has(f.id)).map((f) => ({
    ...renderFixture(f, base), raw_message_id: null, fixture_id: f.id, status: "waiting" as IntakeStatus, obligation_ids: [],
  }));
  const messages = [...stored.map(({ id: _id, ...m }) => m), ...waiting]
    .sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at));
  const phase = read.size === 0 ? "inbox" : !seeded && resetting ? "reading" : !ranked && resetting ? "bidding" : "ranked";
  return c.json({ base: base.toISOString(), running: resetting, phase, messages, agents, thread });
});

const ReplyBody = z.object({ text: z.string().min(1) });

// A text reply as if the user sent it (smoke test, and a stand-in when the phone isn't at hand).
app.post("/api/demo/reply", async (c) => {
  const body = ReplyBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {text}" }, 400);
  await handleReply({ spectrum_message_id: `demo_${newId("rep")}`, text: body.data.text });
  return c.json({ ok: true });
});

// --- voice demo controls (local only: the tunnel guard keeps /api/* off the tunnel) ---

const EscalateBody = z.object({ obligation_id: z.string().optional() });

// Calls now about an item (default: the top of the latest ranking that is still unfinished), skipping
// the follow-up wait and the cooldown. For rehearsal, and a safety net if the demo timing is off.
app.post("/api/demo/escalate", async (c) => {
  const body = EscalateBody.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "body must be {obligation_id?}" }, 400);
  const id = body.data.obligation_id
    ?? latestDecision().ranked.map((r: { obligation_id: string }) => r.obligation_id)
      .find((oid: string) => getOpen().some((o) => o.id === oid));
  if (!id || !getObligation(id)) return c.json({ error: "no open obligation to call about" }, 404);
  const call = await startCall(id, { force: true });
  return c.json({ obligation_id: id, voice_mode: config.VOICE_MODE, call: call ?? null });
});

const CompleteBody = z.object({
  outcome: z.enum(["completed", "no_answer", "declined"]),
  say: z.string().optional(),
});

app.post("/api/demo/calls/:conversationId/complete", async (c) => {
  const body = CompleteBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'body must be {outcome: "completed" | "no_answer" | "declined", say?}' }, 400);
  const r = await completeMockCall(c.req.param("conversationId"), body.data.outcome, body.data.say);
  if (r === "unknown") return c.json({ error: "unknown mock call" }, 404);
  return c.json(r === "already_processed" ? { ok: true, already_processed: true } : { ok: true });
});

// --- boot ---

async function checkGateway(): Promise<void> {
  const url = `${config.OPENCLAW_GATEWAY_URL}/v1/models`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.OPENCLAW_GATEWAY_TOKEN}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = (await res.json()) as { data?: { id: string }[] };
    console.log(`[boot] OpenClaw Gateway OK: ${(data ?? []).map((m) => m.id).join(", ") || "no models"}`);
  } catch (err) {
    console.error(
      `[boot] OpenClaw Gateway not reachable at ${url} (${(err as Error).message}) — run \`openclaw gateway\`. ` +
        "Core keeps running so the judge view still works.",
    );
  }
}

// Loopback only: the tunnel reaches /voice/* through 127.0.0.1; nothing else is exposed.
serve({ fetch: app.fetch, port: config.PORT, hostname: "127.0.0.1" }, (info) => {
  console.log(`[boot] bidby-core on http://127.0.0.1:${info.port} (VOICE_MODE=${config.VOICE_MODE})`);
  void checkGateway();
  startSpectrum();
  startTimer();
});
