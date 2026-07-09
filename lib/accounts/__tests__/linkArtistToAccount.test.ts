import { describe, it, expect, vi, beforeEach } from "vitest";
import { linkArtistToAccount } from "../linkArtistToAccount";

vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/insertAccountArtistId", () => ({
  insertAccountArtistId: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { getAccountArtistIds } = await import(
  "@/lib/supabase/account_artist_ids/getAccountArtistIds"
);
const { insertAccountArtistId } = await import(
  "@/lib/supabase/account_artist_ids/insertAccountArtistId"
);

const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";
const ARTIST_ID = "11111111-1111-4111-8111-111111111111";

describe("linkArtistToAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts the artist and returns success when not already linked", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([]);
    vi.mocked(insertAccountArtistId).mockResolvedValue(undefined);

    const res = await linkArtistToAccount({ accountId: ACCOUNT_ID, artistId: ARTIST_ID });

    expect(res.status).toBe(200);
    expect(insertAccountArtistId).toHaveBeenCalledWith(ACCOUNT_ID, ARTIST_ID);
  });

  it("returns success without inserting when the artist is already linked", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([
      { artist_id: ARTIST_ID, account_id: ACCOUNT_ID },
    ] as never);

    const res = await linkArtistToAccount({ accountId: ACCOUNT_ID, artistId: ARTIST_ID });

    expect(res.status).toBe(200);
    expect(insertAccountArtistId).not.toHaveBeenCalled();
  });

  it("returns 400 with a generic message (no raw error text) when the write fails", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([]);
    vi.mocked(insertAccountArtistId).mockRejectedValue(new Error("boom"));

    const res = await linkArtistToAccount({ accountId: ACCOUNT_ID, artistId: ARTIST_ID });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe("Failed to add artist to account");
    expect(JSON.stringify(body)).not.toContain("boom");
  });
});
