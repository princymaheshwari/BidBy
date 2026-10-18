// npm run tunnel — start a Cloudflare quick tunnel to core (:PORT) and rewire ElevenLabs to its new URL:
//   1. the agent's webhook tools (/voice/tools/*): same paths, new hostname (PATCH /v1/convai/tools/:id)
//   2. the post-call webhook: a workspace webhook's URL can't be changed, so a new one is created, made the
//      workspace's post-call webhook, and the old one deleted; its new HMAC secret goes into .env
//      (`npm run dev` watches .env, so core restarts with it)
//   3. the phone page URL (with BIDBY_PHONE_KEY) is copied to the clipboard
// Keeps running: Ctrl+C stops the tunnel. Secrets are never printed.
// Flags: --url <https://x.trycloudflare.com> rewires to an already running tunnel instead of starting one.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");
process.loadEnvFile(ENV_PATH);

const API = "https://api.elevenlabs.io";
const KEY = process.env.ELEVENLABS_API_KEY ?? "";
const AGENT = process.env.ELEVENLABS_AGENT_ID ?? "";
const PORT = process.env.PORT ?? "8787";
const WEBHOOK_NAME = "BidBy Post Call";
const CLOUDFLARED_FALLBACK = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";

if (!KEY || !AGENT) fail("ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID must be set in .env");

function fail(message: string): never {
  console.error(`[tunnel] ${message}`);
  process.exit(1);
}

async function el<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// --- 1. the tunnel ---

function startTunnel(): Promise<{ url: string; child: ChildProcess }> {
  const args = ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`];
  const bin = process.env.CLOUDFLARED ?? (existsSync(CLOUDFLARED_FALLBACK) ? CLOUDFLARED_FALLBACK : "cloudflared");
  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error("cloudflared printed no trycloudflare.com URL within 60 s")), 60_000);
    const scan = (chunk: Buffer) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString());
      if (m) {
        clearTimeout(timer);
        resolveUrl({ url: m[0], child });
      }
    };
    child.stdout!.on("data", scan);
    child.stderr!.on("data", scan);
    child.on("error", (err) => reject(new Error(`can't start cloudflared (${err.message}); set CLOUDFLARED to its path`)));
    child.on("exit", (code) => reject(new Error(`cloudflared exited (code ${code})`)));
  });
}

/** A new quick tunnel takes a few seconds to resolve; core answers /voice/phone with 401 without the key. */
async function waitReachable(url: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${url}/voice/phone`, { signal: AbortSignal.timeout(5_000) });
      if (res.status === 401 || res.status === 200) return;
    } catch {
      // DNS not there yet
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  console.warn(`[tunnel] ${url} not answering yet; is core running on :${PORT}? Rewiring anyway.`);
}

// --- 2. tools ---

interface ToolConfig { type: string; name: string; api_schema?: { url?: string } }

async function rewireTools(origin: string): Promise<void> {
  const agent = await el<{ conversation_config?: { agent?: { prompt?: { tool_ids?: string[] } } } }>("GET", `/v1/convai/agents/${AGENT}`);
  const ids = agent.conversation_config?.agent?.prompt?.tool_ids ?? [];
  for (const id of ids) {
    const { tool_config } = await el<{ tool_config: ToolConfig }>("GET", `/v1/convai/tools/${id}`);
    const current = tool_config.api_schema?.url;
    if (tool_config.type !== "webhook" || !current) continue;
    const next = origin + new URL(current).pathname;
    if (next === current) {
      console.log(`[tunnel] tool ${tool_config.name}: already ${next}`);
      continue;
    }
    tool_config.api_schema!.url = next;
    await el("PATCH", `/v1/convai/tools/${id}`, { tool_config });
    console.log(`[tunnel] tool ${tool_config.name}: ${next}`);
  }
}

// --- 3. post-call webhook ---

interface Webhook { webhook_id: string; name: string; webhook_url: string }

async function rewirePostCall(origin: string): Promise<void> {
  const target = `${origin}/voice/postcall`;
  const settings = await el<{ webhooks?: Record<string, unknown> & { post_call_webhook_id?: string | null } }>("GET", "/v1/convai/settings");
  const { webhooks: all = [] } = await el<{ webhooks?: Webhook[] }>("GET", "/v1/workspace/webhooks");
  const oldId = settings.webhooks?.post_call_webhook_id ?? null;
  const old = all.find((w) => w.webhook_id === oldId);
  if (old?.webhook_url === target) {
    console.log(`[tunnel] post-call webhook: already ${target}`);
    return;
  }

  const created = await el<{ webhook_id: string; webhook_secret: string }>("POST", "/v1/workspace/webhooks", {
    settings: { auth_type: "hmac", name: WEBHOOK_NAME, webhook_url: target },
  });
  // Keep the other post-call settings (events, transcript format, audio) as they are; swap only the id.
  await el("PATCH", "/v1/convai/settings", { webhooks: { ...settings.webhooks, post_call_webhook_id: created.webhook_id } });
  setEnv("ELEVENLABS_WEBHOOK_SECRET", created.webhook_secret);
  console.log(`[tunnel] post-call webhook: ${target} (new HMAC secret written to .env; core restarts)`);

  for (const w of all.filter((w) => w.name === WEBHOOK_NAME && w.webhook_id !== created.webhook_id)) {
    await el("DELETE", `/v1/workspace/webhooks/${w.webhook_id}`).catch((err) => console.warn(`[tunnel] couldn't delete old webhook: ${err.message}`));
  }
}

function setEnv(name: string, value: string): void {
  const lines = readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (i >= 0) lines[i] = `${name}=${value}`;
  else lines.push(`${name}=${value}`);
  writeFileSync(ENV_PATH, lines.join("\n"));
}

// --- 4. phone page URL ---

function copyPhoneUrl(origin: string): void {
  const key = process.env.BIDBY_PHONE_KEY;
  if (!key) return console.log("[tunnel] BIDBY_PHONE_KEY not set: no phone page URL");
  const url = `${origin}/voice/phone?k=${key}`;
  const clip = process.platform === "win32" ? spawn("clip") : process.platform === "darwin" ? spawn("pbcopy") : null;
  clip?.stdin?.end(url);
  console.log(`[tunnel] phone page: ${origin}/voice/phone?k=<BIDBY_PHONE_KEY>${clip ? " (full URL copied to the clipboard)" : ""}`);
}

// --- main ---

const urlFlag = process.argv.indexOf("--url");
let child: ChildProcess | undefined;
let origin: string;
if (urlFlag >= 0) {
  origin = new URL(process.argv[urlFlag + 1] ?? fail("--url needs a value")).origin;
} else {
  console.log(`[tunnel] starting cloudflared → http://localhost:${PORT}`);
  const started = await startTunnel().catch((err: Error) => fail(err.message));
  child = started.child;
  origin = started.url;
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { child?.kill(); process.exit(0); });
}
console.log(`[tunnel] ${origin}`);

await waitReachable(origin);
try {
  await rewireTools(origin);
  await rewirePostCall(origin);
} catch (err) {
  console.error(`[tunnel] rewiring failed: ${(err as Error).message}`);
}
copyPhoneUrl(origin);
console.log(child ? "[tunnel] ready. Keep this window open; Ctrl+C stops the tunnel." : "[tunnel] done.");
if (!child) process.exit(0);
