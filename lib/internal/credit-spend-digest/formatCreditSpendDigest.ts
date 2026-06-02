import type { CreditSpendDigestRow } from "@/lib/supabase/usage_events/getCreditSpendDigest";

/** Formats integer cents as a USD string, e.g. 412 -> "$4.12". */
function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Compact token count, e.g. 1_240_000 -> "1.2M", 3400 -> "3.4K". */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Builds the Telegram digest message from ranked spend rows. Each account
 * block shows total spend, turn/token/tool volume, the main-vs-subagent
 * split (only when there is subagent spend), and the per-model breakdown.
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
    `Top ${rows.length} account${rows.length === 1 ? "" : "s"} · ${formatUsd(totalCents)} total`;

  const blocks = rows.map((row, index) => {
    const who = row.account_name || row.account_email || row.account_id;
    const lines = [`${index + 1}. ${who} — ${formatUsd(row.total_cents)}`];

    if (row.account_name && row.account_email) {
      lines.push(`   ${row.account_email}`);
    }

    lines.push(
      `   ${row.turn_count} turn${row.turn_count === 1 ? "" : "s"} · ` +
        `${formatTokens(row.input_tokens + row.output_tokens)} tokens · ` +
        `${row.tool_calls} tool calls`,
    );

    if (row.subagent_cents > 0) {
      lines.push(
        `   main ${formatUsd(row.main_cents)} · subagent ${formatUsd(row.subagent_cents)}`,
      );
    }

    const models = Object.entries(row.by_model).sort((a, b) => b[1] - a[1]);
    if (models.length > 0) {
      lines.push(
        `   ${models.map(([model, cents]) => `${model}: ${formatUsd(cents)}`).join(", ")}`,
      );
    }

    return lines.join("\n");
  });

  return [header, ...blocks].join("\n\n");
}
