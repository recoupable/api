import type { Tables } from "@/types/database.types";
import { formatCentsAsUsd } from "@/lib/credits/formatCentsAsUsd";

/** One line item of `GET /api/accounts/{id}/usage`. */
export interface UsageEventItem {
  id: string;
  created_at: string;
  source: string | null;
  agent_type: string | null;
  provider: string | null;
  model_id: string | null;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  tool_call_count: number | null;
  /** Charge in credits (integer micro-dollars). */
  credits_deducted: number;
  /** The same charge formatted as USD with two decimals. */
  usd: string;
}

/**
 * Maps a `usage_events` row to the documented line item. The charge is
 * exposed as `credits_deducted`, the ledger integer, with the USD string
 * derived from it by the shared formatter.
 *
 * @param row - A `usage_events` row.
 * @returns The response item.
 */
export function toUsageEvent(row: Tables<"usage_events">): UsageEventItem {
  return {
    id: row.id,
    created_at: new Date(row.created_at).toISOString(),
    source: row.source,
    agent_type: row.agent_type,
    provider: row.provider,
    model_id: row.model_id,
    input_tokens: row.input_tokens,
    cached_input_tokens: row.cached_input_tokens,
    output_tokens: row.output_tokens,
    tool_call_count: row.tool_call_count,
    credits_deducted: row.credits_deducted_cents,
    usd: formatCentsAsUsd(row.credits_deducted_cents),
  };
}
