import { describe, it, expect, vi, beforeEach } from "vitest";
import { addArtistToAccountHandler } from "../addArtistToAccountHandler";

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

describe("addArtistToAccountHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts the artist and returns success when not already linked", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([]);
    vi.mocked(insertAccountArtistId).mockResolvedValue(undefined);

    const res = await addArtistToAccountHandler({ accountId: ACCOUNT_ID, artistId: ARTIST_ID });

    expect(res.status).toBe(200);
    expect(insertAccountArtistId).toHaveBeenCalledWith(ACCOUNT_ID, ARTIST_ID);
  });

  it("returns success without inserting when the artist is already linked", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([
      { artist_id: ARTIST_ID, account_id: ACCOUNT_ID },
    ] as never);

    const res = await addArtistToAccountHandler({ accountId: ACCOUNT_ID, artistId: ARTIST_ID });

    expect(res.status).toBe(200);
    expect(insertAccountArtistId).not.toHaveBeenCalled();
  });

  it("returns 400 when the database write fails", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([]);
    vi.mocked(insertAccountArtistId).mockRejectedValue(new Error("boom"));

    const res = await addArtistToAccountHandler({ accountId: ACCOUNT_ID, artistId: ARTIST_ID });

    expect(res.status).toBe(400);
  });
});
