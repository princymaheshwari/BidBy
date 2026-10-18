// Priority score (SYSTEM_DESIGN §8). Pure: the same bids and time always give the same order.
// Computed in code, never by an LLM.

export interface ScoreInput {
  amount_at_risk_usd: number;
  reversible: boolean;
  blocks_other_aid: boolean;
  deadline_at: string;
}

const HOUR_MS = 3_600_000;

/** Hours from `at` to the deadline, never negative. */
export function hoursLeft(deadlineAt: string, at: Date): number {
  return Math.max(0, (Date.parse(deadlineAt) - at.getTime()) / HOUR_MS);
}

/** amount × 24 / (24 + hours_left) × (blocks other aid ? 2 : 1) × (reversible ? 0.5 : 1) */
export function score(input: ScoreInput, at: Date): number {
  return (
    input.amount_at_risk_usd *
    (24 / (24 + hoursLeft(input.deadline_at, at))) *
    (input.blocks_other_aid ? 2 : 1) *
    (input.reversible ? 0.5 : 1)
  );
}

/** Highest score first; ties go to the earlier deadline, then the id (so the order is total). */
export function rankByScore<T extends ScoreInput & { obligation_id: string }>(items: T[], at: Date) {
  return items
    .map((item) => ({ item, score: score(item, at) }))
    .sort((a, b) =>
      b.score - a.score ||
      Date.parse(a.item.deadline_at) - Date.parse(b.item.deadline_at) ||
      a.item.obligation_id.localeCompare(b.item.obligation_id));
}
