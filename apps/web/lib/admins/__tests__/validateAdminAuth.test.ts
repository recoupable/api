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

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({}),
}));

const { validateAdminAuth } = await import("../validateAdminAuth");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateAdminAuth", () => {
  it("returns auth context when account is admin", async () => {
    const authContext = {
      accountId: "admin-123",
      orgId: null,
      authToken: "token",
    };
    mockValidateAuthContext.mockResolvedValue(authContext);
    mockCheckIsAdmin.mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/admins");
    const result = await validateAdminAuth(request);

    expect(result).toEqual(authContext);
    expect(mockValidateAuthContext).toHaveBeenCalledWith(request);
    expect(mockCheckIsAdmin).toHaveBeenCalledWith("admin-123");
  });

  it("returns 403 NextResponse when account is not admin", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "user-456",
      orgId: null,
      authToken: "token",
    });
    mockCheckIsAdmin.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/admins");
    const result = await validateAdminAuth(request);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ status: "error", message: "Forbidden" });
  });

  it("returns 401 NextResponse when auth fails", async () => {
    const authError = NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 },
    );
    mockValidateAuthContext.mockResolvedValue(authError);

    const request = new NextRequest("http://localhost/api/admins");
    const result = await validateAdminAuth(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});
