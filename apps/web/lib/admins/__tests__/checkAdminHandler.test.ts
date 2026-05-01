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

const { checkAdminHandler } = await import("../checkAdminHandler");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAdminHandler", () => {
  it("returns isAdmin: true for admin accounts", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "admin-123",
      orgId: null,
      authToken: "token",
    });
    mockCheckIsAdmin.mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/admins");
    const response = await checkAdminHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "success", isAdmin: true });
    expect(mockCheckIsAdmin).toHaveBeenCalledWith("admin-123");
  });

  it("returns isAdmin: false for non-admin accounts", async () => {
    mockValidateAuthContext.mockResolvedValue({
      accountId: "user-456",
      orgId: null,
      authToken: "token",
    });
    mockCheckIsAdmin.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/admins");
    const response = await checkAdminHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "success", isAdmin: false });
  });

  it("returns 401 when auth fails", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/admins");
    const response = await checkAdminHandler(request);

    expect(response.status).toBe(401);
  });

  it("returns 500 on unexpected error", async () => {
    mockValidateAuthContext.mockRejectedValue(new Error("DB down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new NextRequest("http://localhost/api/admins");
    const response = await checkAdminHandler(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ status: "error", message: "Internal server error" });
    consoleSpy.mockRestore();
  });
});
