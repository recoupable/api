import { describe, it, expect, vi, beforeEach } from "vitest";
import { grantAutoTopUpCredits } from "@/lib/credits/grantAutoTopUpCredits";

const { incrementMock, insertMock } = vi.hoisted(() => ({
  incrementMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/incrementRemainingCredits", () => ({
  incrementRemainingCredits: incrementMock,
}));
vi.mock("@/lib/supabase/usage_events/insertUsageEvent", () => ({
  insertUsageEvent: insertMock,
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.clearAllMocks());

describe("grantAutoTopUpCredits", () => {
  it("raises the balance and records a stripe usage event carrying the grant as a negative deduction", async () => {
    incrementMock.mockResolvedValue({});
    insertMock.mockResolvedValue({});

    await grantAutoTopUpCredits({
      accountId: ACCOUNT,
      credits: 100_000_000,
      paymentIntentId: "pi_123",
    });

    expect(incrementMock).toHaveBeenCalledWith({ accountId: ACCOUNT, delta: 100_000_000 });
    expect(insertMock).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      source: "api",
      agent_type: "main",
      provider: "stripe",
      model_id: "auto_topup",
      credits_deducted: -100_000_000,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      tool_call_count: 0,
      resource_url: "/billing",
    });
  });

  it("increments before recording, so a failed event insert never hides a paid grant", async () => {
    const order: string[] = [];
    incrementMock.mockImplementation(async () => {
      order.push("increment");
    });
    insertMock.mockImplementation(async () => {
      order.push("insert");
    });

    await grantAutoTopUpCredits({ accountId: ACCOUNT, credits: 5, paymentIntentId: "pi" });

    expect(order).toEqual(["increment", "insert"]);
  });
});
