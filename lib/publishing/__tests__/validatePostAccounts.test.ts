import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validatePostAccounts } from "../validatePostAccounts";
import { isArtistAccount } from "@/lib/artists/isArtistAccount";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/artists/isArtistAccount", () => ({ isArtistAccount: vi.fn() }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const artist = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";

describe("validatePostAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isArtistAccount).mockResolvedValue(false);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
  });

  it("rejects an artist as the charged account with 400", async () => {
    vi.mocked(isArtistAccount).mockResolvedValue(true);
    const res = (await validatePostAccounts({ accountId })) as NextResponse;
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.missing_fields).toEqual(["account_id"]);
    expect(json.error).toBe("account_id is an artist; pass it as artist_account_id");
  });

  it("rejects an artist the account cannot access with 403", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    const res = (await validatePostAccounts({
      accountId,
      artist_account_id: artist,
    })) as NextResponse;
    expect(res.status).toBe(403);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(accountId, artist);
  });

  it("accepts an artist the account can access", async () => {
    await expect(
      validatePostAccounts({ accountId, artist_account_id: artist }),
    ).resolves.toBeNull();
  });

  it("skips the artist check when no artist is named", async () => {
    await expect(validatePostAccounts({ accountId })).resolves.toBeNull();
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });
});
