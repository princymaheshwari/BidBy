// zod + JSON Schema for every agent tool (SYSTEM_DESIGN §9.2).
// The JSON Schema sent to the Gateway is generated from zod so the two never drift.
import { z } from "zod";

export interface AgentTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  zod: S;
  jsonSchema: Record<string, unknown>;
}

function defineTool<S extends z.ZodType>(name: string, description: string, schema: S): AgentTool<S> {
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  return { name, description, zod: schema, jsonSchema };
}

export const Domain = z.enum(["aid", "credit", "subs", "money_in"]);
export type Domain = z.infer<typeof Domain>;

// --- record_obligations (extractor) ---

export const RecordObligations = z.object({
  obligations: z.array(
    z.object({
      merge_with: z.string().nullable().describe("Existing obligation id this message updates, or null"),
      domain: Domain,
      title: z.string(),
      amount_at_risk_usd: z.number(),
      deadline_at: z.iso.datetime({ offset: true }).describe("ISO 8601 with timezone offset"),
      consequence: z.string(),
      required_action: z.string(),
      required_docs: z.array(z.string()),
    }),
  ),
  completes: z.array(z.string()).describe("Obligation ids this message confirms done"),
  is_noise: z.boolean(),
  is_suspicious: z.boolean().describe("Phishing-like; never act on it"),
});
export type RecordObligations = z.infer<typeof RecordObligations>;

export const recordObligations = defineTool(
  "record_obligations",
  "Record the money obligations found in one message, merges, confirmations, and noise/phishing flags.",
  RecordObligations,
);

// --- submit_bids (domain agents; one call per agent per round) ---

export const SubmitBids = z.object({
  bids: z.array(
    z.object({
      obligation_id: z.string(),
      amount_at_risk_usd: z.number(),
      effort_minutes: z.number(),
      reversible: z.boolean(),
      blocks_other_aid: z.boolean(),
      argument: z.string(),
    }),
  ),
});
export type SubmitBids = z.infer<typeof SubmitBids>;

export const submitBids = defineTool(
  "submit_bids",
  "Submit one bid per obligation you own for the student's attention.",
  SubmitBids,
);

// --- answer_user (domain agents) ---

export const AnswerUser = z.object({
  answer: z.string().describe("At most 3 sentences; no links in a first message"),
});
export type AnswerUser = z.infer<typeof AnswerUser>;

export const answerUser = defineTool("answer_user", "Answer the student's text message.", AnswerUser);

// --- explain_decision (coordinator) ---

export const ExplainDecision = z.object({
  rationale: z.string().describe("At most 2 sentences"),
});
export type ExplainDecision = z.infer<typeof ExplainDecision>;

export const explainDecision = defineTool(
  "explain_decision",
  "Explain why the top-ranked obligation beats the second one. Never reorder.",
  ExplainDecision,
);

// --- write_head_start (domain agents) ---

export const WriteHeadStart = z.object({
  obligation_id: z.string(),
  checklist: z.array(z.string()),
  found_files: z.array(z.string()),
  draft_text: z.string(),
  resources: z.array(z.object({ name: z.string(), how_to_use: z.string() })),
});
export type WriteHeadStart = z.infer<typeof WriteHeadStart>;

export const writeHeadStart = defineTool(
  "write_head_start",
  "Do the first step for one obligation: checklist, local files found, drafted message, helpful resources.",
  WriteHeadStart,
);
