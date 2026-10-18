// emit() writes an events row and fans out to SSE clients (GET /api/events).
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { now } from "./clock.js";
import { db, newId } from "./db.js";

export interface BidbyEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  at: string;
}

type Listener = (event: BidbyEvent) => void;
const listeners = new Set<Listener>();

export function emit(type: string, payload: Record<string, unknown> = {}): BidbyEvent {
  const event: BidbyEvent = { id: newId("evt"), type, payload, at: now().toISOString() };
  db.prepare("INSERT INTO events (id, type, payload, at) VALUES (?, ?, ?, ?)")
    .run(event.id, event.type, JSON.stringify(event.payload), event.at);
  for (const listener of listeners) listener(event);
  return event;
}

/** The last n events, oldest first. */
export function recentEvents(n = 50): BidbyEvent[] {
  const rows = db.prepare("SELECT * FROM events ORDER BY rowid DESC LIMIT ?").all(n) as unknown as
    { id: string; type: string; payload: string; at: string }[];
  return rows.reverse().map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}

const KEEPALIVE_MS = 15_000;

/** SSE handler: replays the last 50 events, then streams new ones live. */
export function eventsStream(c: Context) {
  return streamSSE(c, async (stream) => {
    const send = (e: BidbyEvent) => stream.writeSSE({ id: e.id, data: JSON.stringify(e) });

    for (const e of recentEvents(50)) await send(e);

    const listener: Listener = (e) => void send(e).catch(() => listeners.delete(listener));
    listeners.add(listener);
    stream.onAbort(() => {
      listeners.delete(listener);
    });

    while (!stream.aborted) {
      await stream.sleep(KEEPALIVE_MS);
      if (!stream.aborted) await stream.write(": keepalive\n\n");
    }
    listeners.delete(listener);
  });
}
