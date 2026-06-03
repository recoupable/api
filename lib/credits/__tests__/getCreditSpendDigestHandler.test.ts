import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { CreditSpendDigestRow } from "@/lib/supabase/usage_events/getCreditSpendDigest";

const mockValidate = vi.fn();
vi.mock("../validateGetCreditSpendDigestRequest", () => ({
  validateGetCreditSpendDigestRequest: (...args: unknown[]) => mockValidate(...args),
}));

const mockGetDigest = vi.fn();
vi.mock("@/lib/supabase/usage_events/getCreditSpendDigest", () => ({
  getCreditSpendDigest: (...args: unknown[]) => mockGetDigest(...args),
}));

const mockSendMessage = vi.fn();
vi.mock("@/lib/telegram/sendMessage", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const { getCreditSpendDigestHandler } = await import("../getCreditSpendDigestHandler");

function request(): NextRequest {
  return new NextRequest("http://localhost/api/internal/credit-spend-digest");
}

const sampleRow: CreditSpendDigestRow = {
  account_id: "acc-1",
  account_name: "Jane",
  account_email: "jane@example.com",
  total_cents: 412,
  turn_count: 7,
  input_tokens: 1000,
  output_tokens: 200,
  cached_input_tokens: 0,
  tool_calls: 3,
  main_cents: 412,
  subagent_cents: 0,
  by_model: { "claude-opus": 412 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockValidate.mockReturnValue(null);
  mockGetDigest.mockResolvedValue([]);
  mockSendMessage.mockResolvedValue(undefined);
});

describe("getCreditSpendDigestHandler", () => {
  it("short-circuits with the validator response when unauthorized", async () => {
    mockValidate.mockReturnValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );

    const res = await getCreditSpendDigestHandler(request());
    expect(res.status).toBe(401);
    expect(mockGetDigest).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("no-ops without sending when the window is empty", async () => {
    mockGetDigest.mockResolvedValue([]);

    const res = await getCreditSpendDigestHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", sent: false, accounts: 0 });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("sends a digest when there is spend in the window", async () => {
    mockGetDigest.mockResolvedValue([sampleRow]);

    const res = await getCreditSpendDigestHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", sent: true, accounts: 1 });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toContain("Jane — $4.12");
  });

  it("returns 500 when the digest query throws", async () => {
    mockGetDigest.mockRejectedValue(new Error("db down"));

    const res = await getCreditSpendDigestHandler(request());
    expect(res.status).toBe(500);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
