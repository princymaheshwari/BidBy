// F3: before BidBy interrupts the user, the item's domain agent does the first step: a checklist,
// the local files found, a drafted message, and resources that help (SYSTEM_DESIGN §10 flow C).
// One head start per obligation, reused until the obligation's fields or the aid documents change.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callAgent, type AgentId } from "../agents/openclaw.js";
import { writeHeadStart } from "../agents/schemas.js";
import { formatNY, now } from "../clock.js";
import { REPO_ROOT, config } from "../config.js";
import { db, newId } from "../db.js";
import { emit } from "../events.js";
import { keepExisting, missingDocs } from "./docs.js";
import { getObligation, type Obligation } from "./ledger.js";
import { hoursLeft } from "./score.js";

/** The aid agent's documents (synced into its OpenClaw workspace as docs/ by setup-openclaw.sh --sync). */
const AID_DOCS = resolve(REPO_ROOT, "openclaw/agents/aid/docs");
const RESOURCES_FILE = "school_resources.md"; // always read from the repo
const TEXT_DOC = /\.(md|txt)$/i;
const SKIP = new Set([RESOURCES_FILE, "desktop.ini", "thumbs.db"]);

/** Where the student's documents live on this computer (USER_DOCS_DIR, else the repo's aid docs). */
export const docsFolder = (): string => resolve(config.USER_DOCS_DIR ?? AID_DOCS);

export interface HeadStart {
  id: string;
  obligation_id: string;
  checklist: string[];
  found_files: string[];
  draft_text: string;
  resources: { name: string; how_to_use: string }[];
  missing: string[];
}

const inFlight = new Map<string, Promise<HeadStart | null>>();

/** The head start for an obligation, writing one if none is current. Never throws; null if the agent fails. */
export function headStart(obligationId: string): Promise<HeadStart | null> {
  const running = inFlight.get(obligationId);
  if (running) return running;
  const job = build(obligationId)
    .catch((err) => {
      console.error(`[headstart] ${obligationId}: ${(err as Error).message}`);
      return null;
    })
    .finally(() => inFlight.delete(obligationId));
  inFlight.set(obligationId, job);
  return job;
}

async function build(obligationId: string): Promise<HeadStart | null> {
  const ob = getObligation(obligationId);
  if (!ob) return null;
  const docs = ob.domain === "aid" ? readAidDocs() : null;
  const fingerprint = fingerprintOf(ob, docs);

  const cached = latestHeadStart(ob);
  if (cached && lastFingerprint(ob.id) === fingerprint) return cached;

  const at = now();
  const result = await callAgent(ob.domain as AgentId, buildPrompt(ob, docs, at), writeHeadStart);
  if (!result) return null;

  const { kept, dropped } = keepExisting(result.found_files, docs?.files.map((f) => f.name) ?? []);
  const id = newId("hs");
  db.prepare(
    "INSERT INTO head_starts (id, obligation_id, checklist, found_files, draft_text, resources) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, ob.id, JSON.stringify(result.checklist), JSON.stringify(kept), result.draft_text, JSON.stringify(result.resources));
  const missing = missingDocs(ob.required_docs, kept);
  emit("headstart.ready", {
    obligation_id: ob.id, head_start_id: id, found_files: kept, missing, dropped_files: dropped,
    resources: result.resources.map((r) => r.name), fingerprint,
  });
  return { id, obligation_id: ob.id, checklist: result.checklist, found_files: kept, draft_text: result.draft_text, resources: result.resources, missing };
}

function buildPrompt(ob: Obligation, docs: AidDocs | null, at: Date): string {
  const context: Record<string, unknown> = {
    student: { name: config.STUDENT_NAME },
    obligation: {
      id: ob.id, domain: ob.domain, title: ob.title, amount_at_risk_usd: ob.amount_at_risk_usd,
      deadline_at: ob.deadline_at, hours_left: Math.round(hoursLeft(ob.deadline_at, at) * 10) / 10,
      consequence: ob.consequence, required_action: ob.required_action, required_docs: ob.required_docs,
    },
  };
  if (docs) {
    context.workspace_files = docs.files.map((f) => ({ path: `docs/${f.name}`, title: f.title }));
    context.school_resources = docs.resources;
  }
  return (
    `Task: do the first step for this obligation. Call write_head_start with obligation_id "${ob.id}".\n` +
    `now: ${at.toISOString()} (${formatNY(at)})\n\nContext (JSON):\n${JSON.stringify(context, null, 2)}`
  );
}

// --- the aid workspace documents ---

interface AidDocs {
  files: { name: string; title: string }[]; // the student's documents (everything but the resources file)
  resources: string;
}

function readAidDocs(): AidDocs {
  const dir = docsFolder();
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith(".") && !SKIP.has(d.name.toLowerCase()))
    .map((d) => d.name)
    .sort();
  // Text files are titled by their first line; anything else (PDFs, scans) by its file name.
  const files = names.map((name) => ({
    name,
    title: TEXT_DOC.test(name) ? firstLine(readFileSync(resolve(dir, name), "utf8")) : name.replace(/\.[^.]+$/, ""),
  }));
  const resourcesPath = resolve(AID_DOCS, RESOURCES_FILE);
  const resources = readdirSync(AID_DOCS).includes(RESOURCES_FILE) ? readFileSync(resourcesPath, "utf8") : "";
  return { files, resources };
}

/** File names in the student's documents folder. */
export const docFileNames = (): string[] => readAidDocs().files.map((f) => f.name);

const firstLine = (text: string) => (text.split(/\r?\n/).find((l) => l.trim()) ?? "").replace(/^#+\s*/, "").trim();

// --- cache: reuse the latest head start while the obligation and the documents are unchanged ---

function fingerprintOf(ob: Obligation, docs: AidDocs | null): string {
  const { title, amount_at_risk_usd, deadline_at, consequence, required_action, required_docs } = ob;
  const payload = { title, amount_at_risk_usd, deadline_at, consequence, required_action, required_docs, files: docs?.files.map((f) => f.name) ?? [] };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function lastFingerprint(obligationId: string): string | undefined {
  const row = db.prepare(
    `SELECT json_extract(payload, '$.fingerprint') AS fp FROM events
     WHERE type = 'headstart.ready' AND json_extract(payload, '$.obligation_id') = ? ORDER BY rowid DESC LIMIT 1`,
  ).get(obligationId) as { fp: string | null } | undefined;
  return row?.fp ?? undefined;
}

/** The newest stored head start for an obligation (no agent call). */
export function latestHeadStart(ob: Obligation): HeadStart | undefined {
  const row = db.prepare("SELECT * FROM head_starts WHERE obligation_id = ? ORDER BY rowid DESC LIMIT 1").get(ob.id) as
    { id: string; obligation_id: string; checklist: string; found_files: string; draft_text: string; resources: string } | undefined;
  if (!row) return undefined;
  const found_files: string[] = JSON.parse(row.found_files);
  return {
    id: row.id, obligation_id: row.obligation_id, checklist: JSON.parse(row.checklist), found_files,
    draft_text: row.draft_text, resources: JSON.parse(row.resources), missing: missingDocs(ob.required_docs, found_files),
  };
}
