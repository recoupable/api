import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { getAccountEmailsHandler } from "../getAccountEmailsHandler";

describe("getAccountEmailsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when currentAccountId is missing", async () => {
    const result = await getAccountEmailsHandler({
      accountIds: ["a1"],
      currentAccountId: "",
      artistAccountId: "art-1",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json.error).toBeDefined();
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when artistAccountId is missing", async () => {
    const result = await getAccountEmailsHandler({
      accountIds: ["a1"],
      currentAccountId: "acc-1",
      artistAccountId: "",
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns empty array when accountIds is empty", async () => {
    const result = await getAccountEmailsHandler({
      accountIds: [],
      currentAccountId: "acc-1",
      artistAccountId: "art-1",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json).toEqual([]);
    expect((result as NextResponse).status).toBe(200);
  });

  it("returns 403 when access check fails", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const result = await getAccountEmailsHandler({
      accountIds: ["a1"],
      currentAccountId: "acc-1",
      artistAccountId: "art-1",
    });

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("acc-1", "art-1");
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns emails on success", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(selectAccountEmails).mockResolvedValue([
      { account_id: "a1", email: "test@example.com", id: 1 } as any,
    ]);

    const result = await getAccountEmailsHandler({
      accountIds: ["a1"],
      currentAccountId: "acc-1",
      artistAccountId: "art-1",
    });

    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: ["a1"] });
    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json).toEqual([{ account_id: "a1", email: "test@example.com", id: 1 }]);
    expect((result as NextResponse).status).toBe(200);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(checkAccountArtistAccess).mockRejectedValue(new Error("db down"));

    const result = await getAccountEmailsHandler({
      accountIds: ["a1"],
      currentAccountId: "acc-1",
      artistAccountId: "art-1",
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(500);
  });
});
