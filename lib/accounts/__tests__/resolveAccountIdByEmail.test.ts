import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { resolveAccountIdByEmail } from "../resolveAccountIdByEmail";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountIdFromEmail } from "@/lib/accounts/resolveAccountIdFromEmail";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/accounts/resolveAccountIdFromEmail", () => ({
  resolveAccountIdFromEmail: vi.fn(),
}));

describe("resolveAccountIdByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountId when auth passes and email resolves", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "admin-123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAccountIdFromEmail).mockResolvedValue("customer-456");
    // Second validateAuthContext call for access check
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "customer-456",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest("http://localhost/api/accounts/test@example.com");
    const result = await resolveAccountIdByEmail(req, "test@example.com");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toBe("customer-456");
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/test@example.com");
    const result = await resolveAccountIdByEmail(req, "test@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(resolveAccountIdFromEmail).not.toHaveBeenCalled();
  });

  it("returns 404 when email not found", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce({
      accountId: "admin-123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAccountIdFromEmail).mockResolvedValue(
      NextResponse.json({ error: "No account found" }, { status: 404 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/unknown@example.com");
    const result = await resolveAccountIdByEmail(req, "unknown@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 403 when caller lacks access", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce({
      accountId: "admin-123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(resolveAccountIdFromEmail).mockResolvedValue("customer-456");
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json({ error: "Access denied" }, { status: 403 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/other@example.com");
    const result = await resolveAccountIdByEmail(req, "other@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
