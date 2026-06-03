import type { CreditSpendDigestRow } from "@/lib/supabase/usage_events/getCreditSpendDigest";
import { formatCentsAsUsd } from "./formatCentsAsUsd";
import { formatCompactTokens } from "./formatCompactTokens";

/**
 * Builds the Telegram digest message from ranked spend rows. Each account
 * block shows total spend, turn/token/tool volume, the main-vs-subagent
 * split (only when there is subagent spend), and the per-model breakdown.
 *
 * Token total is `input + output`; `cached_input_tokens` is a subset of
 * input (cache reads are still input tokens, priced as input), so it is
 * shown as an informational parenthetical rather than added to the total.
 *
 * Length is bounded by the caller's top-N limit; `sendMessage` applies the
 * final Telegram length cap via `trimMessage`, so no extra trimming here.
 *
 * @param rows - Ranked spend rows (highest total first).
 * @param windowMinutes - Window size, for the header label.
 * @returns The formatted digest text.
 */
export function formatCreditSpendDigest(
  rows: CreditSpendDigestRow[],
  windowMinutes: number,
): string {
  const totalCents = rows.reduce((sum, r) => sum + r.total_cents, 0);
  const header =
    `💸 Credit spend — last ${windowMinutes}m\n` +
    `Top ${rows.length} account${rows.length === 1 ? "" : "s"} · ${formatCentsAsUsd(totalCents)} total`;

  const blocks = rows.map((row, index) => {
    const who = row.account_name || row.account_email || row.account_id;
    const lines = [`${index + 1}. ${who} — ${formatCentsAsUsd(row.total_cents)}`];

    if (row.account_name && row.account_email) {
      lines.push(`   ${row.account_email}`);
    }

    const tokens = formatCompactTokens(row.input_tokens + row.output_tokens);
    const cached =
      row.cached_input_tokens > 0
        ? ` (${formatCompactTokens(row.cached_input_tokens)} cached)`
        : "";
    lines.push(
      `   ${row.turn_count} turn${row.turn_count === 1 ? "" : "s"} · ` +
        `${tokens} tokens${cached} · ` +
        `${row.tool_calls} tool calls`,
    );

    if (row.subagent_cents > 0) {
      lines.push(
        `   main ${formatCentsAsUsd(row.main_cents)} · subagent ${formatCentsAsUsd(row.subagent_cents)}`,
      );
    }

    const models = Object.entries(row.by_model).sort((a, b) => b[1] - a[1]);
    if (models.length > 0) {
      lines.push(
        `   ${models.map(([model, cents]) => `${model}: ${formatCentsAsUsd(cents)}`).join(", ")}`,
      );
    }

    return lines.join("\n");
  });

  return [header, ...blocks].join("\n\n");
}
