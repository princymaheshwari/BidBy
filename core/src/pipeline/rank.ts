// F2: each domain agent bids on its obligations, code scores and orders them, the coordinator
// explains #1 vs #2 (SYSTEM_DESIGN §10 flow B). The order is never decided by an LLM.
import { callAgent, type AgentId } from "../agents/openclaw.js";
import { explainDecision, submitBids, type Domain, type SubmitBids } from "../agents/schemas.js";
import { formatNY, now } from "../clock.js";
import { db, newId } from "../db.js";
import { emit } from "../events.js";
import { getMessages, listObligations, type Obligation } from "./ledger.js";
import { hoursLeft, rankByScore } from "./score.js";

export interface Decision {
  decision_id: string | null;
  round_id: string | null;
  ranked: { obligation_id: string; score: number }[];
  rationale: string;
}

type Bid = SubmitBids["bids"][number] & { id: string; agent_id: string; deadline_at: string; title: string };

const RANKED_STATUSES = new Set(["open", "notified", "escalated"]);
const DOMAINS: Domain[] = ["aid", "credit", "subs", "money_in"];

// --- debounce: never two rounds at once; a request during a round triggers exactly one more ---

let running: Promise<Decision> | null = null;
let rerun = false;

export function rank(): Promise<Decision> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      let decision: Decision;
      do {
        rerun = false;
        decision = await rankOnce();
      } while (rerun);
      return decision;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Ranks in the background (after ingest); failures are logged, not thrown. */
export function rankSoon(): void {
  rank().catch((err) => console.error("[rank]", err));
}

// --- one round ---

async function rankOnce(): Promise<Decision> {
  const at = now();
  const obligations = listObligations().filter((o) => RANKED_STATUSES.has(o.status));
  if (obligations.length === 0) {
    return { decision_id: null, round_id: null, ranked: [], rationale: "Nothing is at risk right now." };
  }

  const round_id = newId("round");
  const byDomain = DOMAINS.map((d) => [d, obligations.filter((o) => o.domain === d)] as const).filter(([, obs]) => obs.length);
  const bidLists = await Promise.all(byDomain.map(([domain, obs]) => collectBids(domain, obs, at)));
  const bids = bidLists.flat();

  for (const b of bids) {
    db.prepare(
      `INSERT INTO bids (id, round_id, obligation_id, agent_id, amount_at_risk_usd, effort_minutes, reversible,
         blocks_other_aid, argument) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(b.id, round_id, b.obligation_id, b.agent_id, b.amount_at_risk_usd, b.effort_minutes,
      b.reversible ? 1 : 0, b.blocks_other_aid ? 1 : 0, b.argument);
    emit("bid.submitted", {
      round_id, bid_id: b.id, obligation_id: b.obligation_id, title: b.title, agent_id: b.agent_id,
      amount_at_risk_usd: b.amount_at_risk_usd, reversible: b.reversible, blocks_other_aid: b.blocks_other_aid,
    });
  }

  const ranked = rankByScore(bids, at).map(({ item, score }) => ({ bid: item, score: round2(score) }));
  const rationale = await explain(ranked, at);

  const decision_id = newId("dec");
  const scores = Object.fromEntries(ranked.map((r) => [r.bid.obligation_id, r.score]));
  db.prepare("INSERT INTO decisions (id, round_id, ranked_ids, scores, rationale, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(decision_id, round_id, JSON.stringify(ranked.map((r) => r.bid.obligation_id)), JSON.stringify(scores),
      rationale, at.toISOString());
  emit("decision.made", {
    decision_id, round_id, ranked_ids: ranked.map((r) => r.bid.obligation_id),
    top_title: ranked[0]!.bid.title, top_score: ranked[0]!.score, rationale,
  });

  return { decision_id, round_id, ranked: ranked.map((r) => ({ obligation_id: r.bid.obligation_id, score: r.score })), rationale };
}

/** One submit_bids call for a domain; exactly one bid per obligation, falling back to the ledger amount. */
async function collectBids(domain: Domain, obs: Obligation[], at: Date): Promise<Bid[]> {
  const context = {
    obligations: obs.map((o) => ({
      id: o.id, title: o.title, amount_at_risk_usd: o.amount_at_risk_usd, deadline_at: o.deadline_at,
      hours_left: round2(hoursLeft(o.deadline_at, at)), consequence: o.consequence,
      required_action: o.required_action, required_docs: o.required_docs,
      // The original messages, so the agent bids on what was actually said, not only the extractor's summary.
      source_messages: getMessages(o.source_message_ids).map(({ source, sender, subject, body, received_at }) =>
        ({ source, sender, subject, body, received_at })),
    })),
  };
  const prompt =
    "Task: bid for the student's attention. Call submit_bids with exactly one bid per obligation below, " +
    "using its id as obligation_id.\n" +
    `now: ${at.toISOString()} (${formatNY(at)})\n\nContext (JSON):\n${JSON.stringify(context, null, 2)}`;
  const result = await callAgent(domain as AgentId, prompt, submitBids);

  const byId = new Map(obs.map((o) => [o.id, o]));
  const bids = new Map<string, Bid>();
  for (const b of result?.bids ?? []) {
    const ob = byId.get(b.obligation_id);
    if (!ob || bids.has(b.obligation_id)) continue; // not this agent's obligation, or a duplicate
    bids.set(b.obligation_id, { ...b, id: newId("bid"), agent_id: domain, deadline_at: ob.deadline_at, title: ob.title });
  }
  for (const ob of obs) {
    if (bids.has(ob.id)) continue;
    bids.set(ob.id, {
      id: newId("bid"), agent_id: "ledger", obligation_id: ob.id, amount_at_risk_usd: ob.amount_at_risk_usd,
      effort_minutes: 0, reversible: false, blocks_other_aid: false, deadline_at: ob.deadline_at, title: ob.title,
      argument: `No bid from the ${domain} agent; using the ledger amount.`,
    });
  }
  return [...bids.values()];
}

async function explain(ranked: { bid: Bid; score: number }[], at: Date): Promise<string> {
  const top = ranked[0]!;
  const context = {
    ranked: ranked.map((r, i) => ({
      rank: i + 1, obligation_id: r.bid.obligation_id, title: r.bid.title, score: r.score,
      deadline_at: r.bid.deadline_at, hours_left: round2(hoursLeft(r.bid.deadline_at, at)),
    })),
    bids: ranked.map(({ bid: { obligation_id, title, agent_id, amount_at_risk_usd, effort_minutes, reversible, blocks_other_aid, argument } }) =>
      ({ obligation_id, title, agent_id, amount_at_risk_usd, effort_minutes, reversible, blocks_other_aid, argument })),
  };
  const prompt =
    `Task: explain in at most 2 sentences why #1 (${top.bid.title}) ranks above #2. Call explain_decision.\n` +
    `now: ${at.toISOString()} (${formatNY(at)})\n\nContext (JSON):\n${JSON.stringify(context, null, 2)}`;
  const result = await callAgent("coordinator", prompt, explainDecision);
  if (result) return firstSentences(result.rationale, 2);

  const hours = Math.round(hoursLeft(top.bid.deadline_at, at));
  return `${top.bid.title} ranks first: $${top.bid.amount_at_risk_usd.toLocaleString("en-US")} at risk, due in ${hours} hours.`;
}

/** Keeps at most n sentences (the design caps the rationale at 2). */
function firstSentences(text: string, n: number): string {
  const sentences = text.trim().split(/(?<=[.!?])\s+(?=[A-Z$#"(])/);
  return sentences.slice(0, n).join(" ");
}

const round2 = (x: number) => Math.round(x * 100) / 100;

// --- reads for the API ---

/** obligation_id -> score from the latest decision. */
export function latestScores(): Record<string, number> {
  const row = db.prepare("SELECT scores FROM decisions ORDER BY rowid DESC LIMIT 1").get() as { scores: string } | undefined;
  return row ? JSON.parse(row.scores) : {};
}

/** Bids (with obligation titles), scores and rationale of the latest round. */
export function latestDecision() {
  const dec = db.prepare("SELECT * FROM decisions ORDER BY rowid DESC LIMIT 1").get() as
    { id: string; round_id: string; ranked_ids: string; scores: string; rationale: string; created_at: string } | undefined;
  if (!dec) return { decision_id: null, round_id: null, created_at: null, rationale: null, ranked: [], bids: [] };

  type BidRow = {
    id: string; round_id: string; obligation_id: string; agent_id: string; amount_at_risk_usd: number;
    effort_minutes: number; reversible: number; blocks_other_aid: number; argument: string;
    title: string; domain: Domain; deadline_at: string;
  };
  const scores: Record<string, number> = JSON.parse(dec.scores);
  const bids = (db.prepare(
    `SELECT b.*, o.title, o.domain, o.deadline_at FROM bids b JOIN obligations o ON o.id = b.obligation_id
     WHERE b.round_id = ?`,
  ).all(dec.round_id) as unknown as BidRow[])
    .map((b) => ({ ...b, reversible: b.reversible === 1, blocks_other_aid: b.blocks_other_aid === 1, score: scores[b.obligation_id] ?? null }));
  const ranked = (JSON.parse(dec.ranked_ids) as string[]).map((id, i) => {
    const bid = bids.find((b) => b.obligation_id === id);
    return { rank: i + 1, obligation_id: id, title: bid?.title ?? null, domain: bid?.domain ?? null, score: scores[id] ?? null };
  });
  return {
    decision_id: dec.id, round_id: dec.round_id, created_at: dec.created_at, rationale: dec.rationale,
    ranked, bids: ranked.map((r) => bids.find((b) => b.obligation_id === r.obligation_id)).filter(Boolean),
  };
}
