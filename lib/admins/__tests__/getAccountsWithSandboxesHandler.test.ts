import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuthContext = vi.fn();
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

const mockCheckIsAdmin = vi.fn();
vi.mock("../checkIsAdmin", () => ({
  checkIsAdmin: (...args: unknown[]) => mockCheckIsAdmin(...args),
}));

const mockSelectAllAccountSandboxSummaries = vi.fn();
vi.mock("@/lib/supabase/account_sandboxes/selectAllAccountSandboxSummaries", () => ({
  selectAllAccountSandboxSummaries: (...args: unknown[]) =>
    mockSelectAllAccountSandboxSummaries(...args),
}));

const { getAccountsWithSandboxesHandler } = await import("../getAccountsWithSandboxesHandler");

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuthContext.mockResolvedValue({
    accountId: "admin-123",
    orgId: null,
    authToken: "token",
  });
  mockCheckIsAdmin.mockResolvedValue(true);
  mockSelectAllAccountSandboxSummaries.mockResolvedValue([]);
});

/**
 * Creates a mock NextRequest for testing.
 */
function createRequest() {
  return new NextRequest("http://localhost/api/admins/accounts-with-sandboxes", {
    headers: { "x-api-key": "test-key" },
  });
}

describe("getAccountsWithSandboxesHandler", () => {
  it("returns account sandbox summaries for admins", async () => {
    const summaries = [
      {
        account_id: "acc-1",
        account_name: "Alice",
        total_sandboxes: 3,
        last_created_at: "2026-03-10T12:00:00Z",
      },
    ];
    mockSelectAllAccountSandboxSummaries.mockResolvedValue(summaries);

    const response = await getAccountsWithSandboxesHandler(createRequest());
    const body = await response.json();

    expect(body.status).toBe("success");
    expect(body.accounts).toEqual(summaries);
  });

  it("returns 403 for non-admin users", async () => {
    mockCheckIsAdmin.mockResolvedValue(false);

    const response = await getAccountsWithSandboxesHandler(createRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Admin access required");
  });

  it("returns empty accounts array when no sandboxes exist", async () => {
    mockSelectAllAccountSandboxSummaries.mockResolvedValue([]);

    const response = await getAccountsWithSandboxesHandler(createRequest());
    const body = await response.json();

    expect(body.status).toBe("success");
    expect(body.accounts).toEqual([]);
  });
});
