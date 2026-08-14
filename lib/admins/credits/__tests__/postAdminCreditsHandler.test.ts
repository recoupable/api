import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockValidateGrantCreditsRequest = vi.fn();
vi.mock("@/lib/admins/credits/validateGrantCreditsRequest", () => ({
  validateGrantCreditsRequest: (...args: unknown[]) => mockValidateGrantCreditsRequest(...args),
}));

const mockSelectAccounts = vi.fn();
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: (...args: unknown[]) => mockSelectAccounts(...args),
}));

const mockGrantCreditsWithAudit = vi.fn();
vi.mock("@/lib/supabase/credit_grants/grantCreditsWithAudit", () => ({
  grantCreditsWithAudit: (...args: unknown[]) => mockGrantCreditsWithAudit(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({}),
}));

const { postAdminCreditsHandler } = await import("../postAdminCreditsHandler");

const ACCOUNT = "fb678396-a68f-4294-ae50-b8cacf9ce77b";
const ADMIN = "22222222-2222-2222-2222-222222222222";
const GRANT = "33333333-3333-3333-3333-333333333333";

const validated = {
  accountId: ACCOUNT,
  remainingCredits: 9999,
  reason: "Trial headroom for the Aug 12 label demo",
  grantedBy: ADMIN,
};

const grantRow = {
  id: GRANT,
  account_id: ACCOUNT,
  granted_by: ADMIN,
  reason: "Trial headroom for the Aug 12 label demo",
  previous_credits: 12,
  remaining_credits: 9999,
  created_at: "2026-08-06T23:00:00.000Z",
};

function request() {
  return new NextRequest("http://localhost/api/admins/credits", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateGrantCreditsRequest.mockResolvedValue(validated);
  mockSelectAccounts.mockResolvedValue([{ id: ACCOUNT }]);
  mockGrantCreditsWithAudit.mockResolvedValue(grantRow);
});

describe("postAdminCreditsHandler", () => {
  it("returns the grant under the documented response shape", async () => {
    const response = await postAdminCreditsHandler(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      grant_id: GRANT,
      account_id: ACCOUNT,
      remaining_credits: 9999,
      previous_credits: 12,
      reason: "Trial headroom for the Aug 12 label demo",
      granted_by: ADMIN,
      granted_at: "2026-08-06T23:00:00.000Z",
      expires_at: "2026-09-06T23:00:00.000Z",
    });
  });

  it("passes the validated grant through to the atomic write", async () => {
    await postAdminCreditsHandler(request());

    expect(mockGrantCreditsWithAudit).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      grantedBy: ADMIN,
      reason: "Trial headroom for the Aug 12 label demo",
      remainingCredits: 9999,
    });
  });

  it("reports a null previous_credits when the account had no credits row", async () => {
    mockGrantCreditsWithAudit.mockResolvedValue({ ...grantRow, previous_credits: null });

    const body = await (await postAdminCreditsHandler(request())).json();

    expect(body.previous_credits).toBeNull();
  });

  it("returns the validation response untouched (401/403/400)", async () => {
    mockValidateGrantCreditsRequest.mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const response = await postAdminCreditsHandler(request());

    expect(response.status).toBe(403);
    expect(mockGrantCreditsWithAudit).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown account_id, and writes nothing", async () => {
    mockSelectAccounts.mockResolvedValue([]);

    const response = await postAdminCreditsHandler(request());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.status).toBe("error");
    expect(mockGrantCreditsWithAudit).not.toHaveBeenCalled();
  });

  it("returns 500 when the grant write fails, and does not claim success", async () => {
    mockGrantCreditsWithAudit.mockRejectedValue(new Error("transaction rolled back"));

    const response = await postAdminCreditsHandler(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe("error");
    expect(body.grant_id).toBeUndefined();
  });

  it("does not leak the underlying error message to the caller", async () => {
    mockGrantCreditsWithAudit.mockRejectedValue(
      new Error("connection string is postgres://secret"),
    );

    const body = await (await postAdminCreditsHandler(request())).json();

    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
