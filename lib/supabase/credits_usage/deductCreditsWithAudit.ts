import supabase from "@/lib/supabase/serverClient";

/**
 * JSON payload populating the `usage_events` audit row. Optional
 * fields fall back to column defaults (`source='api'`,
 * `agent_type='main'`, provider/model_id NULL, counts 0) inside the
 * SQL function — see `database/supabase/migrations/20260525000000_deduct_credits_with_audit.sql`.
 */
export interface DeductCreditsAuditEvent {
  source?: "api" | "web";
  agent_type?: "main" | "subagent";
  provider?: string;
  model_id?: string;
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  tool_call_count?: number;
}

export type DeductCreditsWithAuditResult = { ok: true } | { ok: false; error: string };

/**
 * Atomically debits `credits_usage.remaining_credits` and inserts the
 * corresponding `usage_events` audit row via the
 * `deduct_credits_with_audit` Postgres function. The SQL function
 * runs both writes inside an implicit transaction so wallet/meter
 * can never drift on partial failure — matching open-agents'
 * `recordUsage` `db.transaction(...)` guarantee.
 *
 * Caller convention: `cents` is the amount to debit (integer ≥ 1).
 * `eventId` should match `lib/supabase/usage_events/insertUsageEvent.ts`'s
 * nanoid convention so the audit trail is consistent.
 *
 * Errors are never thrown — returns `{ ok: false, error }` instead so
 * the caller (`recordChatUsage`) can swallow without aborting the
 * chat workflow on a credit accounting hiccup.
 */
export async function deductCreditsWithAudit(params: {
  accountId: string;
  cents: number;
  eventId: string;
  event: DeductCreditsAuditEvent;
}): Promise<DeductCreditsWithAuditResult> {
  try {
    const { error } = await supabase.rpc("deduct_credits_with_audit", {
      p_account_id: params.accountId,
      p_amount: params.cents,
      p_event_id: params.eventId,
      p_event: params.event,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
