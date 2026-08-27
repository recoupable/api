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

const mockSelectCreditGrants = vi.fn();
vi.mock("@/lib/supabase/credit_grants/selectCreditGrants", () => ({
  selectCreditGrants: (...args: unknown[]) => mockSelectCreditGrants(...args),
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
  mockSelectCreditGrants.mockResolvedValue([]);
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
        credits_deducted: 7,
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
    expect(body.events[0].credits_deducted).toBe(7);
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

  it("returns admin grants alongside the debits, so a hand-set balance is attributable", async () => {
    mockSelectCreditGrants.mockResolvedValue([
      {
        id: "33333333-3333-3333-3333-333333333333",
        account_id: ACCT,
        granted_by: "22222222-2222-2222-2222-222222222222",
        reason: "Trial headroom for the Aug 12 label demo",
        previous_credits: 12,
        remaining_credits: 9999,
        created_at: "2026-08-06T23:00:00.000Z",
      },
    ]);

    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}`,
    );
    const body = await (await getAdminCreditsEventsHandler(request)).json();

    expect(body.grants).toHaveLength(1);
    expect(body.grants[0].granted_by).toBe("22222222-2222-2222-2222-222222222222");
    expect(body.grants[0].reason).toBe("Trial headroom for the Aug 12 label demo");
    expect(body.grants[0].previous_credits).toBe(12);
  });

  it("always returns a grants array, empty for the accounts that were never granted anything", async () => {
    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}`,
    );
    const body = await (await getAdminCreditsEventsHandler(request)).json();

    expect(body.grants).toEqual([]);
  });

  it("scopes grants to the same account and period as the events", async () => {
    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}&period=weekly`,
    );
    await getAdminCreditsEventsHandler(request);

    expect(mockSelectCreditGrants).toHaveBeenCalledTimes(1);
    const call = mockSelectCreditGrants.mock.calls[0][0];
    expect(call.accountId).toBe(ACCT);
    expect(call.createdAfter).toBe(mockSelectUsageEvents.mock.calls[0][0].createdAfter);
  });

  it("leaves total_count describing usage_events only, not grants", async () => {
    mockCountUsageEvents.mockResolvedValue(3);
    mockSelectCreditGrants.mockResolvedValue([{ id: "g1" }, { id: "g2" }]);

    const request = new NextRequest(
      `http://localhost/api/admins/credits/events?account_id=${ACCT}`,
    );
    const body = await (await getAdminCreditsEventsHandler(request)).json();

    expect(body.total_count).toBe(3);
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
