import { describe, it, expect } from "vitest";
import { formatCreditSpendDigest } from "../formatCreditSpendDigest";
import type { CreditSpendDigestRow } from "@/lib/supabase/usage_events/getCreditSpendDigest";

function row(overrides: Partial<CreditSpendDigestRow> = {}): CreditSpendDigestRow {
  return {
    account_id: "acc-1",
    account_name: "Jane",
    account_email: "jane@example.com",
    total_cents: 412,
    turn_count: 7,
    input_tokens: 1_200_000,
    output_tokens: 40_000,
    cached_input_tokens: 0,
    tool_calls: 3,
    main_cents: 412,
    subagent_cents: 0,
    by_model: { "claude-opus": 300, "claude-haiku": 112 },
    ...overrides,
  };
}

describe("formatCreditSpendDigest", () => {
  it("formats cents as USD and renders header total + rank", () => {
    const out = formatCreditSpendDigest([row()], 10);
    expect(out).toContain("last 10m");
    expect(out).toContain("Top 1 account · $4.12 total");
    expect(out).toContain("1. Jane — $4.12");
    expect(out).toContain("jane@example.com");
  });

  it("renders compact token totals (input + output) and tool calls", () => {
    const out = formatCreditSpendDigest([row()], 10);
    expect(out).toContain("7 turns · 1.2M tokens · 3 tool calls");
  });

  it("renders the per-model breakdown sorted by spend desc", () => {
    const out = formatCreditSpendDigest([row()], 10);
    expect(out).toContain("claude-opus: $3.00, claude-haiku: $1.12");
  });

  it("shows cached tokens as an informational parenthetical (not added to the total)", () => {
    const out = formatCreditSpendDigest([row({ cached_input_tokens: 300_000 })], 10);
    // total stays input + output = 1.24M, cached shown separately
    expect(out).toContain("1.2M tokens (300.0K cached)");
  });

  it("omits the cached parenthetical when there are no cached tokens", () => {
    const out = formatCreditSpendDigest([row({ cached_input_tokens: 0 })], 10);
    expect(out).not.toContain("cached");
  });

  it("omits the main/subagent split when there is no subagent spend", () => {
    const out = formatCreditSpendDigest([row({ subagent_cents: 0 })], 10);
    expect(out).not.toContain("subagent");
  });

  it("shows the main/subagent split when subagent spend exists", () => {
    const out = formatCreditSpendDigest([row({ main_cents: 300, subagent_cents: 112 })], 10);
    expect(out).toContain("main $3.00 · subagent $1.12");
  });

  it("falls back to email then account_id when name is missing", () => {
    const noName = formatCreditSpendDigest([row({ account_name: null })], 10);
    expect(noName).toContain("1. jane@example.com — $4.12");

    const noNameNoEmail = formatCreditSpendDigest(
      [row({ account_name: null, account_email: null })],
      10,
    );
    expect(noNameNoEmail).toContain("1. acc-1 — $4.12");
  });

  it("singularizes the account/turn labels for single values", () => {
    const out = formatCreditSpendDigest([row({ turn_count: 1 })], 10);
    expect(out).toContain("Top 1 account ");
    expect(out).toContain("1 turn ·");
  });
});
