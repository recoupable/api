import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveOrCreateArtist } from "@/lib/artists/resolveOrCreateArtist";
import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { findCanonicalArtistBySpotifyId } from "@/lib/valuation/findCanonicalArtistBySpotifyId";
import { upsertAccountArtistId } from "@/lib/supabase/account_artist_ids/upsertAccountArtistId";
import { selectAccountWithSocials } from "@/lib/supabase/accounts/selectAccountWithSocials";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";

vi.mock("@/lib/artists/createArtistInDb", () => ({ createArtistInDb: vi.fn() }));
vi.mock("@/lib/valuation/findCanonicalArtistBySpotifyId", () => ({
  findCanonicalArtistBySpotifyId: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/upsertAccountArtistId", () => ({
  upsertAccountArtistId: vi.fn(),
}));
vi.mock("@/lib/supabase/accounts/selectAccountWithSocials", () => ({
  selectAccountWithSocials: vi.fn(),
}));
vi.mock("@/lib/artist/updateArtistSocials", () => ({ updateArtistSocials: vi.fn() }));

const SPOTIFY_ID = "0xPoVNPnxIIUS1vrxAYV00";
const created = { id: "new-1", account_id: "new-1", name: "Del Water Gap" };

describe("resolveOrCreateArtist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createArtistInDb).mockResolvedValue(created as never);
    vi.mocked(findCanonicalArtistBySpotifyId).mockResolvedValue(null);
    vi.mocked(selectAccountWithSocials).mockResolvedValue({
      id: "canonical-1",
      name: "Del Water Gap",
    } as never);
  });

  it("creates and attaches the Spotify social when no canonical exists", async () => {
    const result = await resolveOrCreateArtist({
      name: "Del Water Gap",
      accountId: "acct-1",
      spotifyArtistId: SPOTIFY_ID,
    });

    expect(createArtistInDb).toHaveBeenCalledWith("Del Water Gap", "acct-1", undefined);
    expect(updateArtistSocials).toHaveBeenCalledWith("new-1", {
      SPOTIFY: `https://open.spotify.com/artist/${SPOTIFY_ID}`,
    });
    expect(result).toEqual({ artist: created, created: true });
  });

  // One canonical artist per Spotify id (chat#1889, decision 2026-07-29):
  // when it exists, link it to the account — never mint a second row. The link
  // is a blind upsert: idempotency is the database's job, not a precheck's
  // (chat#1965).
  it("links and returns the existing canonical instead of creating", async () => {
    vi.mocked(findCanonicalArtistBySpotifyId).mockResolvedValue("canonical-1");

    const result = await resolveOrCreateArtist({
      name: "Del Water Gap",
      accountId: "acct-1",
      spotifyArtistId: SPOTIFY_ID,
    });

    expect(createArtistInDb).not.toHaveBeenCalled();
    expect(updateArtistSocials).not.toHaveBeenCalled();
    expect(upsertAccountArtistId).toHaveBeenCalledWith("acct-1", "canonical-1");
    expect(result.created).toBe(false);
    expect(result.artist).toMatchObject({ id: "canonical-1", account_id: "canonical-1" });
  });

  it("plain create path is untouched when no spotify id is given", async () => {
    const result = await resolveOrCreateArtist({ name: "X", accountId: "acct-1" });

    expect(findCanonicalArtistBySpotifyId).not.toHaveBeenCalled();
    expect(updateArtistSocials).not.toHaveBeenCalled();
    expect(result).toEqual({ artist: created, created: true });
  });

  // Enrichment is non-fatal (same contract as chat#1892): the row exists by
  // the time the social attach runs, so a failed attach must not fail the add.
  it("returns the created artist when the social attach fails", async () => {
    vi.mocked(updateArtistSocials).mockRejectedValue(new Error("nope"));

    const result = await resolveOrCreateArtist({
      name: "Del Water Gap",
      accountId: "acct-1",
      spotifyArtistId: SPOTIFY_ID,
    });

    expect(result).toEqual({ artist: created, created: true });
  });
});
