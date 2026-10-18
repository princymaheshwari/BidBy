// F4: spectrum-ts send/receive over the cloud iMessage provider (SYSTEM_DESIGN §9.3).
// Every send is paced, written to outbound_texts and emitted as text.sent. Inbound texts from anyone
// but USER_PHONE are ignored. MESSAGING_MODE=log prints texts instead of sending them (smoke tests).
import { setTimeout as sleep } from "node:timers/promises";
import { Spectrum, type Space } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { now } from "../clock.js";
import { SEND_GAP_MS, config } from "../config.js";
import { db, newId } from "../db.js";
import { emit } from "../events.js";
import { handleReply } from "./replies.js";

export type TextKind = "interrupt" | "digest" | "follow_up" | "reply" | "closing";

const connect = (projectId: string, projectSecret: string) =>
  Spectrum({ projectId, projectSecret, providers: [imessage.config()] });
type App = Awaited<ReturnType<typeof connect>>;

let app: Promise<App> | null = null;
let userSpace: Space | null = null;

/** Connects to Spectrum and starts the inbound loop in the background. Never throws: core keeps running. */
export function startSpectrum(): void {
  if (config.MESSAGING_MODE === "log") {
    console.log("[spectrum] MESSAGING_MODE=log: texts are printed, not sent");
    return;
  }
  const { SPECTRUM_PROJECT_ID: id, SPECTRUM_PROJECT_SECRET: secret } = config;
  if (!id || !secret) {
    console.error("[spectrum] SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET missing in .env: texting is off");
    return;
  }
  app = connect(id, secret);
  app.then(
    (a) => {
      console.log("[spectrum] connected (cloud iMessage)");
      void listen(a);
    },
    (err) => console.error(`[spectrum] connect failed: ${(err as Error).message}`),
  );
}

async function listen(a: App): Promise<void> {
  for await (const [space, message] of a.messages) {
    try {
      if (message.direction === "outbound") continue;
      const from = message.sender?.id ?? "";
      if (!samePhone(from, config.USER_PHONE)) {
        console.log(`[spectrum] ignored a text from ${mask(from)} (not USER_PHONE)`);
        emit("text.ignored", { reason: "unknown_sender", from: mask(from) });
        continue;
      }
      userSpace = space;
      if (message.content.type !== "text") {
        emit("text.ignored", { reason: "not_text", content_type: message.content.type });
        continue;
      }
      await handleReply({ spectrum_message_id: message.id, text: message.content.text, sent_at: message.timestamp });
    } catch (err) {
      console.error("[spectrum] inbound message failed:", err);
    }
  }
  console.log("[spectrum] message stream closed");
}

/** The stored DM, or a new one built from USER_PHONE (proactive path: user has texted the line before). */
async function getUserSpace(): Promise<Space> {
  if (userSpace) return userSpace;
  if (!app) throw new Error("Spectrum is not connected (check SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET)");
  const im = imessage(await app);
  userSpace = await im.space.create(await im.user(config.USER_PHONE));
  return userSpace;
}

// --- outbound: one at a time, at least SEND_GAP_MS apart (real time, not demo time) ---

let queue: Promise<unknown> = Promise.resolve();
let lastSentAt = -Infinity;

function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastSentAt + SEND_GAP_MS - performance.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastSentAt = performance.now();
    }
  });
  queue = run.catch(() => {});
  return run;
}

/** Texts the user and records it. Throws if the send fails (nothing is recorded then). */
export async function sendToUser(body: string, kind: TextKind, obligationId: string | null): Promise<string> {
  await paced(async () => {
    if (config.MESSAGING_MODE === "log") console.log(`[text → user] (${kind}) ${body.replace(/\n/g, " ⏎ ")}`);
    else await (await getUserSpace()).send(body);
  });
  const id = newId("txt");
  db.prepare("INSERT INTO outbound_texts (id, obligation_id, kind, body, sent_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, obligationId, kind, body, now().toISOString());
  emit("text.sent", { id, obligation_id: obligationId, kind, body });
  return id;
}

// --- phone helpers ---

const digits = (s: string) => s.replace(/\D/g, "");

/** E.164 comparison that tolerates formatting; emails (Apple ID senders) never match. */
function samePhone(a: string, b: string): boolean {
  return !a.includes("@") && digits(a).length > 0 && digits(a) === digits(b);
}

/** "…1234": enough to tell senders apart in logs without recording their number. */
function mask(sender: string): string {
  return sender ? `…${sender.slice(-4)}` : "unknown";
}
