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

const mockSelectAccounts = vi.fn();
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: (...args: unknown[]) => mockSelectAccounts(...args),
}));

const mockSelectAccountEmails = vi.fn();
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: (...args: unknown[]) => mockSelectAccountEmails(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({}),
}));

const { getAdminCreditsRollupHandler } = await import("../getAdminCreditsRollupHandler");

const mockAuth = { accountId: "admin-123", orgId: null, authToken: "token" };

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAdminAuth.mockResolvedValue(mockAuth);
  mockSelectUsageEvents.mockResolvedValue([]);
  mockSelectAccounts.mockResolvedValue([]);
  mockSelectAccountEmails.mockResolvedValue([]);
});

describe("getAdminCreditsRollupHandler", () => {
  it("returns 401 when auth fails", async () => {
    mockValidateAdminAuth.mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/admins/credits/rollup");
    const response = await getAdminCreditsRollupHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    mockValidateAdminAuth.mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const request = new NextRequest("http://localhost/api/admins/credits/rollup");
    const response = await getAdminCreditsRollupHandler(request);

    expect(response.status).toBe(403);
  });

  it("returns 400 on invalid period", async () => {
    const request = new NextRequest("http://localhost/api/admins/credits/rollup?period=yearly");
    const response = await getAdminCreditsRollupHandler(request);

    expect(response.status).toBe(400);
  });

  it("returns an empty page when there are no usage_events", async () => {
    const request = new NextRequest("http://localhost/api/admins/credits/rollup");
    const response = await getAdminCreditsRollupHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      period: "monthly",
      page: 1,
      limit: 100,
      total_count: 0,
      rows: [],
    });
  });

  it("aggregates by account_id, sorts by total descending, and joins names + emails", async () => {
    mockSelectUsageEvents.mockResolvedValue([
      { account_id: "acc-1", credits_deducted_cents: 5 },
      { account_id: "acc-1", credits_deducted_cents: 7 },
      { account_id: "acc-2", credits_deducted_cents: 50 },
      { account_id: "acc-3", credits_deducted_cents: 1 },
    ]);
    mockSelectAccounts.mockResolvedValue([
      { id: "acc-1", name: "Alice" },
      { id: "acc-2", name: "Bob Inc." },
      { id: "acc-3", name: null },
    ]);
    mockSelectAccountEmails.mockResolvedValue([
      { account_id: "acc-1", email: "alice@example.com", updated_at: "2026-05-01T00:00:00Z" },
      { account_id: "acc-2", email: "bob@example.com", updated_at: "2026-05-02T00:00:00Z" },
    ]);

    const request = new NextRequest("http://localhost/api/admins/credits/rollup");
    const response = await getAdminCreditsRollupHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total_count).toBe(3);
    expect(body.rows).toEqual([
      {
        account_id: "acc-2",
        account_name: "Bob Inc.",
        account_email: "bob@example.com",
        total_credits_deducted_cents: 50,
        event_count: 1,
      },
      {
        account_id: "acc-1",
        account_name: "Alice",
        account_email: "alice@example.com",
        total_credits_deducted_cents: 12,
        event_count: 2,
      },
      {
        account_id: "acc-3",
        account_name: null,
        account_email: null,
        total_credits_deducted_cents: 1,
        event_count: 1,
      },
    ]);
  });

  it("picks the most-recently-updated email for accounts with multiple", async () => {
    mockSelectUsageEvents.mockResolvedValue([{ account_id: "acc-1", credits_deducted_cents: 1 }]);
    mockSelectAccounts.mockResolvedValue([{ id: "acc-1", name: "Alice" }]);
    mockSelectAccountEmails.mockResolvedValue([
      { account_id: "acc-1", email: "old@example.com", updated_at: "2026-01-01T00:00:00Z" },
      { account_id: "acc-1", email: "new@example.com", updated_at: "2026-05-01T00:00:00Z" },
    ]);

    const request = new NextRequest("http://localhost/api/admins/credits/rollup");
    const response = await getAdminCreditsRollupHandler(request);
    const body = await response.json();

    expect(body.rows[0].account_email).toBe("new@example.com");
  });

  it("breaks ties on total_credits by sorting account_id ascending", async () => {
    mockSelectUsageEvents.mockResolvedValue([
      { account_id: "z", credits_deducted_cents: 10 },
      { account_id: "a", credits_deducted_cents: 10 },
      { account_id: "m", credits_deducted_cents: 10 },
    ]);

    const request = new NextRequest("http://localhost/api/admins/credits/rollup");
    const response = await getAdminCreditsRollupHandler(request);
    const body = await response.json();

    expect(body.rows.map((r: { account_id: string }) => r.account_id)).toEqual(["a", "m", "z"]);
  });

  it("respects limit + page (returns the requested slice and the full total_count)", async () => {
    mockSelectUsageEvents.mockResolvedValue([
      { account_id: "a", credits_deducted_cents: 100 },
      { account_id: "b", credits_deducted_cents: 50 },
      { account_id: "c", credits_deducted_cents: 25 },
      { account_id: "d", credits_deducted_cents: 10 },
    ]);

    const request = new NextRequest("http://localhost/api/admins/credits/rollup?limit=2&page=2");
    const response = await getAdminCreditsRollupHandler(request);
    const body = await response.json();

    expect(body.total_count).toBe(4);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(2);
    expect(body.rows.map((r: { account_id: string }) => r.account_id)).toEqual(["c", "d"]);
  });

  it("passes the period cutoff through to the supabase query for non-'all' periods", async () => {
    const request = new NextRequest("http://localhost/api/admins/credits/rollup?period=weekly");
    await getAdminCreditsRollupHandler(request);

    const callArg = mockSelectUsageEvents.mock.calls[0][0];
    expect(callArg.createdAfter).toBeTypeOf("string");
    expect(new Date(callArg.createdAfter as string).getTime()).toBeGreaterThan(0);
  });

  it("omits the createdAfter filter when period='all'", async () => {
    const request = new NextRequest("http://localhost/api/admins/credits/rollup?period=all");
    await getAdminCreditsRollupHandler(request);

    expect(mockSelectUsageEvents).toHaveBeenCalledWith({ createdAfter: undefined });
  });
});
