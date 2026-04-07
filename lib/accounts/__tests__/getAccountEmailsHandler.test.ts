import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAccountEmailsHandler } from "../getAccountEmailsHandler";
import { validateGetAccountEmailsQuery } from "../validateGetAccountEmailsQuery";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetAccountEmailsQuery", () => ({
  validateGetAccountEmailsQuery: vi.fn(),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

function createMockRequest(): NextRequest {
  return {
    url: "http://localhost:3000/api/accounts/emails",
    nextUrl: new URL("http://localhost:3000/api/accounts/emails"),
    headers: new Headers({ authorization: "Bearer test-token" }),
  } as unknown as NextRequest;
}

describe("getAccountEmailsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation response errors directly", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue(
      NextResponse.json({ error: "artist_account_id parameter is required" }, { status: 400 }),
    );

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(result.status).toBe(400);
  });

  it("returns an empty array when no account IDs are provided", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      artistAccountId: "artist-456",
      accountIds: [],
    });

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual([]);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated account cannot access the artist", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      artistAccountId: "artist-456",
      accountIds: ["acc-1"],
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", "artist-456");
    expect(result.status).toBe(403);
    await expect(result.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns raw account email rows when access is allowed", async () => {
    const rows = [
      {
        id: "email-1",
        account_id: "acc-1",
        email: "owner@example.com",
        updated_at: "2026-04-08T00:00:00.000Z",
      },
    ];

    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      artistAccountId: "artist-456",
      accountIds: ["acc-1", "acc-2"],
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectAccountEmails).mockResolvedValue(rows);

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: ["acc-1", "acc-2"] });
    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual(rows);
  });

  it("returns an empty array when account email lookup returns no rows", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      artistAccountId: "artist-456",
      accountIds: ["acc-1"],
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual([]);
  });
});
