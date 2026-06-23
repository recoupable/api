import { describe, it, expect, vi, beforeEach } from "vitest";

import { linkSpotifyArtistToAccount } from "../linkSpotifyArtistToAccount";

const mockSelectSocials = vi.fn();
const mockSelectAccountIdsBySocialId = vi.fn();
const mockGetAccountArtistIds = vi.fn();
const mockInsertAccountArtistId = vi.fn();
const mockCreateArtistInDb = vi.fn();
const mockUpdateArtistSocials = vi.fn();

vi.mock("@/lib/supabase/socials/selectSocials", () => ({
  selectSocials: (...args: unknown[]) => mockSelectSocials(...args),
}));
vi.mock("@/lib/supabase/account_socials/selectAccountIdsBySocialId", () => ({
  selectAccountIdsBySocialId: (...args: unknown[]) => mockSelectAccountIdsBySocialId(...args),
}));
vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: (...args: unknown[]) => mockGetAccountArtistIds(...args),
}));
vi.mock("@/lib/supabase/account_artist_ids/insertAccountArtistId", () => ({
  insertAccountArtistId: (...args: unknown[]) => mockInsertAccountArtistId(...args),
}));
vi.mock("@/lib/artists/createArtistInDb", () => ({
  createArtistInDb: (...args: unknown[]) => mockCreateArtistInDb(...args),
}));
vi.mock("@/lib/artist/updateArtistSocials", () => ({
  updateArtistSocials: (...args: unknown[]) => mockUpdateArtistSocials(...args),
}));

const SPOTIFY_ID = "3TVXtAsR1Inumwj472S9r4";
const PROFILE_URL = `open.spotify.com/artist/${SPOTIFY_ID}`;
const ACCOUNT_ID = "owner-account-id";

describe("linkSpotifyArtistToAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccountArtistIds.mockResolvedValue([]);
    mockInsertAccountArtistId.mockResolvedValue({});
  });

  it("creates a new artist when no social exists, attaches the Spotify social, and links it", async () => {
    mockSelectSocials.mockResolvedValue([]);
    mockCreateArtistInDb.mockResolvedValue({ id: "new-artist-id", account_id: "new-artist-id" });

    const result = await linkSpotifyArtistToAccount({
      spotifyId: SPOTIFY_ID,
      accountId: ACCOUNT_ID,
      name: "Drake",
    });

    expect(mockSelectSocials).toHaveBeenCalledWith({ profile_url: PROFILE_URL });
    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Drake", ACCOUNT_ID, undefined);
    expect(mockUpdateArtistSocials).toHaveBeenCalledWith("new-artist-id", {
      SPOTIFY: `https://open.spotify.com/artist/${SPOTIFY_ID}`,
    });
    // createArtistInDb already inserts the account_artist_ids link, so we must not double-link.
    expect(mockInsertAccountArtistId).not.toHaveBeenCalled();
    expect(result).toEqual({ artistId: "new-artist-id", created: true, linked: true });
  });

  it("reuses an existing artist account behind the Spotify social and links it to the account", async () => {
    mockSelectSocials.mockResolvedValue([{ id: "social-1", profile_url: PROFILE_URL }]);
    mockSelectAccountIdsBySocialId.mockResolvedValue(["existing-artist-id"]);
    mockGetAccountArtistIds.mockResolvedValue([{ artist_id: "some-other-artist" }]);

    const result = await linkSpotifyArtistToAccount({
      spotifyId: SPOTIFY_ID,
      accountId: ACCOUNT_ID,
    });

    expect(mockCreateArtistInDb).not.toHaveBeenCalled();
    expect(mockInsertAccountArtistId).toHaveBeenCalledWith(ACCOUNT_ID, "existing-artist-id");
    expect(result).toEqual({ artistId: "existing-artist-id", created: false, linked: true });
  });

  it("is a no-op link when the existing artist is already on the account's roster", async () => {
    mockSelectSocials.mockResolvedValue([{ id: "social-1", profile_url: PROFILE_URL }]);
    mockSelectAccountIdsBySocialId.mockResolvedValue(["existing-artist-id"]);
    mockGetAccountArtistIds.mockResolvedValue([{ artist_id: "existing-artist-id" }]);

    const result = await linkSpotifyArtistToAccount({
      spotifyId: SPOTIFY_ID,
      accountId: ACCOUNT_ID,
    });

    expect(mockInsertAccountArtistId).not.toHaveBeenCalled();
    expect(result).toEqual({ artistId: "existing-artist-id", created: false, linked: false });
  });

  it("creates a new artist when a social exists but no account is linked to it", async () => {
    mockSelectSocials.mockResolvedValue([{ id: "social-1", profile_url: PROFILE_URL }]);
    mockSelectAccountIdsBySocialId.mockResolvedValue([]);
    mockCreateArtistInDb.mockResolvedValue({ id: "new-artist-id", account_id: "new-artist-id" });

    const result = await linkSpotifyArtistToAccount({
      spotifyId: SPOTIFY_ID,
      accountId: ACCOUNT_ID,
      name: "Drake",
    });

    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Drake", ACCOUNT_ID, undefined);
    expect(result).toEqual({ artistId: "new-artist-id", created: true, linked: true });
  });

  it("falls back to the Spotify id as the name when none is provided on create", async () => {
    mockSelectSocials.mockResolvedValue([]);
    mockCreateArtistInDb.mockResolvedValue({ id: "new-artist-id", account_id: "new-artist-id" });

    await linkSpotifyArtistToAccount({ spotifyId: SPOTIFY_ID, accountId: ACCOUNT_ID });

    expect(mockCreateArtistInDb).toHaveBeenCalledWith(SPOTIFY_ID, ACCOUNT_ID, undefined);
  });

  it("passes organizationId through to createArtistInDb", async () => {
    mockSelectSocials.mockResolvedValue([]);
    mockCreateArtistInDb.mockResolvedValue({ id: "new-artist-id", account_id: "new-artist-id" });

    await linkSpotifyArtistToAccount({
      spotifyId: SPOTIFY_ID,
      accountId: ACCOUNT_ID,
      name: "Drake",
      organizationId: "org-id",
    });

    expect(mockCreateArtistInDb).toHaveBeenCalledWith("Drake", ACCOUNT_ID, "org-id");
  });

  it("throws when artist creation fails", async () => {
    mockSelectSocials.mockResolvedValue([]);
    mockCreateArtistInDb.mockResolvedValue(null);

    await expect(
      linkSpotifyArtistToAccount({ spotifyId: SPOTIFY_ID, accountId: ACCOUNT_ID }),
    ).rejects.toThrow();
  });
});
