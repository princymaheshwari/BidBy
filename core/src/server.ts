// Hono app and routes. Later specs start the tick loop and Spectrum loop here.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { advance, now, setTo } from "./clock.js";
import { config } from "./config.js";
import { clearAll, getSettings } from "./db.js";
import { emit, eventsStream } from "./events.js";
import { findFixture, loadInbox, renderFixture } from "./fixtures.js";
import { ingest } from "./pipeline/ingest.js";
import { dismiss, getObligation, getOpen, listObligations, markDone, snooze } from "./pipeline/ledger.js";
import { latestDecision, latestScores, rank } from "./pipeline/rank.js";

const INDEX_HTML = resolve(import.meta.dirname, "../public/index.html");
const HOUR_MS = 3_600_000;
const DEFAULT_SNOOZE_HOURS = 2;

const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

// Read on each request so edits to the page show up without a restart.
app.get("/", (c) => c.html(readFileSync(INDEX_HTML, "utf8")));

app.get("/api/events", (c) => eventsStream(c));

// --- ingest + ledger ---

const IngestBody = z.object({
  source: z.enum(["email", "slack", "bank"]),
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
  return c.json({ now: t.toISOString() });
});

let resetting = false;

// Clears state, ingests the seeded inbox in received order (every received_at is in the past), then ranks once.
app.post("/api/demo/reset", async (c) => {
  if (resetting) return c.json({ error: "a reset is already running" }, 409);
  resetting = true;
  try {
    clearAll();
    emit("demo.reset", { now: now().toISOString() });
    const base = now();
    const inbox = loadInbox().sort((a, b) => a.received_at_offset_hours - b.received_at_offset_hours);
    for (const f of inbox) await ingest(renderFixture(f, base), { fixture_id: f.id, rank: false });
    emit("demo.seeded", { messages: inbox.length, open_obligations: getOpen().length });
    await rank();
    return c.json({ ok: true });
  } finally {
    resetting = false;
  }
});

const InjectBody = z.object({ fixture_id: z.string() });

app.post("/api/demo/inject", async (c) => {
  const body = InjectBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {fixture_id}" }, 400);

  const fixture = findFixture(body.data.fixture_id);
  if (!fixture) return c.json({ error: `unknown fixture "${body.data.fixture_id}"` }, 404);
  return c.json(await ingest(renderFixture(fixture, now()), { fixture_id: fixture.id }));
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
  console.log(`[boot] bidby-core on http://127.0.0.1:${info.port}`);
  void checkGateway();
});
