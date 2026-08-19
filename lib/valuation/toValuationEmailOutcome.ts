import type { SendValuationReportEmailResult } from "@/lib/emails/valuationReport/sendValuationReportEmail";

/**
 * The valuation email's fate for one run, as the lead alert reports it
 * (chat#1969). Skips come from the handler's gate (no streams) or the send
 * path itself (dedup, no recipient).
 */
export type ValuationEmailOutcome =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/** Collapse the send result into the outcome the Telegram lead alert renders. */
export function toValuationEmailOutcome(
  result: SendValuationReportEmailResult,
): ValuationEmailOutcome {
  if (result.sent) return { status: "sent" };
  if ("skipped" in result) {
    return {
      status: "skipped",
      reason: result.skipped === "already_sent" ? "already sent" : "no email on account",
    };
  }
  return { status: "failed", error: (result as { error: string }).error };
}
