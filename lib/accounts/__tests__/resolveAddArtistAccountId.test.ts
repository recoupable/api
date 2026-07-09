import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { resolveAddArtistAccountId } from "../resolveAddArtistAccountId";

vi.mock("@/lib/accounts/resolveAccountIdByEmail", () => ({
  resolveAccountIdByEmail: vi.fn(),
}));

vi.mock("@/lib/auth/checkAccountAccess", () => ({
  checkAccountAccess: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { resolveAccountIdByEmail } = await import("@/lib/accounts/resolveAccountIdByEmail");
const { checkAccountAccess } = await import("@/lib/auth/checkAccountAccess");

const AUTH_ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";

describe("resolveAddArtistAccountId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the authenticated account when no email is provided", async () => {
    const result = await resolveAddArtistAccountId(AUTH_ACCOUNT_ID, undefined);

    expect(result).toBe(AUTH_ACCOUNT_ID);
    expect(resolveAccountIdByEmail).not.toHaveBeenCalled();
    expect(checkAccountAccess).not.toHaveBeenCalled();
  });

  it("returns the account when email resolves to the caller's own account", async () => {
    vi.mocked(resolveAccountIdByEmail).mockResolvedValue(AUTH_ACCOUNT_ID);

    const result = await resolveAddArtistAccountId(AUTH_ACCOUNT_ID, "me@example.com");

    expect(result).toBe(AUTH_ACCOUNT_ID);
    expect(checkAccountAccess).not.toHaveBeenCalled();
  });

  it("returns the target account when the caller has access", async () => {
    vi.mocked(resolveAccountIdByEmail).mockResolvedValue(TARGET_ACCOUNT_ID);
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: true, entityType: "artist" });

    const result = await resolveAddArtistAccountId(AUTH_ACCOUNT_ID, "other@example.com");

    expect(result).toBe(TARGET_ACCOUNT_ID);
    expect(checkAccountAccess).toHaveBeenCalledWith(AUTH_ACCOUNT_ID, TARGET_ACCOUNT_ID);
  });

  it("returns 403 when the caller lacks access to the target account", async () => {
    vi.mocked(resolveAccountIdByEmail).mockResolvedValue(TARGET_ACCOUNT_ID);
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: false });

    const result = await resolveAddArtistAccountId(AUTH_ACCOUNT_ID, "other@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("propagates the error response when the email is not found", async () => {
    const notFound = NextResponse.json({ status: "error" }, { status: 404 });
    vi.mocked(resolveAccountIdByEmail).mockResolvedValue(notFound);

    const result = await resolveAddArtistAccountId(AUTH_ACCOUNT_ID, "missing@example.com");

    expect(result).toBe(notFound);
    expect(checkAccountAccess).not.toHaveBeenCalled();
  });
});
