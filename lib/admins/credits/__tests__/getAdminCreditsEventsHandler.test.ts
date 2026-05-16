import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockValidateAdminAuth = vi.fn();
vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: (...args: unknown[]) => mockValidateAdminAuth(...args),
}));

const mockSelectUsageEvents = vi.fn();
vi.mock("@/lib/supabase/usage_events/selectUsageEvents", () => ({
  selectUsageEvents: (...args: unknown[]) => mockSelectUsageEvents(...args),
}));

const mockCountUsageEvents = vi.fn();
vi.mock("@/lib/supabase/usage_events/countUsageEvents", () => ({
  countUsageEvents: (...args: unknown[]) => mockCountUsageEvents(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({}),
}));

const { getAdminCreditsEventsHandler } = await import("../getAdminCreditsEventsHandler");

const mockAuth = { accountId: "admin-123", orgId: null, authToken: "token" };
const ACCT = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAdminAuth.mockResolvedValue(mockAuth);
  mockSelectUsageEvents.mockResolvedValue([]);
  mockCountUsageEvents.mockResolvedValue(0);
});

describe("getAdminCreditsEventsHandler", () => {
  it("returns 401 when auth fails", async () => {
    mockValidateAdminAuth.mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}`,
    );
    const response = await getAdminCreditsEventsHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    mockValidateAdminAuth.mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}`,
    );
    const response = await getAdminCreditsEventsHandler(request);

    expect(response.status).toBe(403);
  });

  it("returns 400 when account_id is missing", async () => {
    const request = new NextRequest("http://localhost/api/admins/credits/events");
    const response = await getAdminCreditsEventsHandler(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when account_id is not a UUID", async () => {
    const request = new NextRequest(
      "http://localhost/api/admins/credits/events?account_id=not-a-uuid",
    );
    const response = await getAdminCreditsEventsHandler(request);

    expect(response.status).toBe(400);
  });

  it("returns the supabase rows + total_count under the contract response shape", async () => {
    mockSelectUsageEvents.mockResolvedValue([
      {
        id: "evt_1",
        account_id: ACCT,
        source: "web",
        agent_type: "main",
        provider: "anthropic",
        model_id: "anthropic/claude-opus-4.6",
        input_tokens: 11062,
        cached_input_tokens: 0,
        output_tokens: 6,
        tool_call_count: 0,
        credits_deducted_cents: 7,
        created_at: "2026-05-15T18:31:22.747Z",
      },
    ]);
    mockCountUsageEvents.mockResolvedValue(42);

    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}&page=2&limit=25`,
    );
    const response = await getAdminCreditsEventsHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.account_id).toBe(ACCT);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(25);
    expect(body.total_count).toBe(42);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].credits_deducted_cents).toBe(7);
  });

  it("passes range + cutoff through to the supabase select", async () => {
    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}&period=weekly&limit=50&page=3`,
    );
    await getAdminCreditsEventsHandler(request);

    expect(mockSelectUsageEvents).toHaveBeenCalledTimes(1);
    const call = mockSelectUsageEvents.mock.calls[0][0];
    expect(call.accountId).toBe(ACCT);
    expect(call.from).toBe(100);
    expect(call.to).toBe(149);
    expect(call.createdAfter).toBeTypeOf("string");
  });

  it("omits createdAfter when period='all'", async () => {
    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}&period=all`,
    );
    await getAdminCreditsEventsHandler(request);

    const call = mockSelectUsageEvents.mock.calls[0][0];
    expect(call.createdAfter).toBeUndefined();
  });
});
