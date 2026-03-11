import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockValidateAuthContext = vi.fn();
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

const mockCheckIsAdmin = vi.fn();
vi.mock("../checkIsAdmin", () => ({
  checkIsAdmin: (...args: unknown[]) => mockCheckIsAdmin(...args),
}));

const mockSelectAllAccountSandboxStats = vi.fn();
vi.mock("@/lib/supabase/account_sandboxes/selectAllAccountSandboxStats", () => ({
  selectAllAccountSandboxStats: (...args: unknown[]) => mockSelectAllAccountSandboxStats(...args),
}));

const mockSupabaseFrom = vi.fn();
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({}),
}));

const { getAdminSandboxesHandler } = await import("../getAdminSandboxesHandler");

const mockAuth = { accountId: "admin-123", orgId: null, authToken: "token" };

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAuthContext.mockResolvedValue(mockAuth);
  mockCheckIsAdmin.mockResolvedValue(true);
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
});

describe("getAdminSandboxesHandler", () => {
  it("returns 401 when auth fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/admins/sandboxes");
    const response = await getAdminSandboxesHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when caller is not an admin", async () => {
    mockCheckIsAdmin.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/admins/sandboxes");
    const response = await getAdminSandboxesHandler(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Forbidden");
  });

  it("returns empty accounts array when no sandboxes exist", async () => {
    mockSelectAllAccountSandboxStats.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admins/sandboxes");
    const response = await getAdminSandboxesHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "success", accounts: [] });
  });

  it("returns account sandbox stats with account names", async () => {
    mockSelectAllAccountSandboxStats.mockResolvedValue([
      { account_id: "acc-1", total_sandboxes: 5, last_created_at: "2026-03-10T12:00:00Z" },
      { account_id: "acc-2", total_sandboxes: 2, last_created_at: "2026-03-09T08:00:00Z" },
    ]);

    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [
          { id: "acc-1", name: "Alice" },
          { id: "acc-2", name: "Bob" },
        ],
        error: null,
      }),
    });

    const request = new NextRequest("http://localhost/api/admins/sandboxes");
    const response = await getAdminSandboxesHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.accounts).toHaveLength(2);
    expect(body.accounts[0]).toEqual({
      account_id: "acc-1",
      account_name: "Alice",
      total_sandboxes: 5,
      last_created_at: "2026-03-10T12:00:00Z",
    });
    expect(body.accounts[1]).toEqual({
      account_id: "acc-2",
      account_name: "Bob",
      total_sandboxes: 2,
      last_created_at: "2026-03-09T08:00:00Z",
    });
  });

  it("falls back to null account_name when account not found in accounts table", async () => {
    mockSelectAllAccountSandboxStats.mockResolvedValue([
      { account_id: "acc-unknown", total_sandboxes: 1, last_created_at: "2026-03-10T00:00:00Z" },
    ]);

    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const request = new NextRequest("http://localhost/api/admins/sandboxes");
    const response = await getAdminSandboxesHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accounts[0].account_name).toBeNull();
  });
});
