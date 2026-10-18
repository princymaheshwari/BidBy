// Hono app and routes. Later specs start the tick loop and Spectrum loop here.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { advance, now, setTo } from "./clock.js";
import { config } from "./config.js";
import { clearAll, db, getSettings, newId } from "./db.js";
import { emit, eventsStream } from "./events.js";
import { findFixture, type Fixture } from "./fixtures.js";

const INDEX_HTML = resolve(import.meta.dirname, "../public/index.html");
const HOUR_MS = 3_600_000;

const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

// Read on each request so edits to the page show up without a restart.
app.get("/", (c) => c.html(readFileSync(INDEX_HTML, "utf8")));

app.get("/api/events", (c) => eventsStream(c));

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

app.post("/api/demo/reset", (c) => {
  clearAll();
  emit("demo.reset", { now: now().toISOString() });
  return c.json({ ok: true });
});

const InjectBody = z.object({ fixture_id: z.string() });

app.post("/api/demo/inject", async (c) => {
  const body = InjectBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "body must be {fixture_id}" }, 400);

  const fixture = findFixture(body.data.fixture_id);
  if (!fixture) return c.json({ error: `unknown fixture "${body.data.fixture_id}"` }, 404);

  // Until spec 02 wires in ingest(), inject only stores the raw message.
  const raw_message_id = storeRawMessage(fixture);
  return c.json({ raw_message_id, obligation_ids: [], completed_ids: [] });
});

function storeRawMessage(f: Fixture): string {
  const id = newId("msg");
  const received_at = new Date(now().getTime() + f.received_at_offset_hours * HOUR_MS).toISOString();
  db.prepare(
    "INSERT INTO raw_messages (id, source, sender, subject, body, received_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, f.source, f.sender, f.subject, f.body, received_at);
  emit("message.received", {
    raw_message_id: id, fixture_id: f.id, source: f.source, sender: f.sender, subject: f.subject,
  });
  return id;
}

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
