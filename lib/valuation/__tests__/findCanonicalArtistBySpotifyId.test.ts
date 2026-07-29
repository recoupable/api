import { describe, it, expect, vi, beforeEach } from "vitest";
import { findCanonicalArtistBySpotifyId } from "@/lib/valuation/findCanonicalArtistBySpotifyId";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { selectAccountArtistIds } from "@/lib/supabase/account_artist_ids/selectAccountArtistIds";

vi.mock("@/lib/supabase/socials/selectSocials", () => ({
  selectSocials: vi.fn(),
}));
vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistIds", () => ({
  selectAccountArtistIds: vi.fn(),
}));

const SPOTIFY_ID = "0xPoVNPnxIIUS1vrxAYV00";

describe("findCanonicalArtistBySpotifyId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectAccountArtistIds).mockResolvedValue([] as never);
  });

  // Artists are canonical and shared (chat#1866); account_artist_ids is the
  // join that lets many accounts roster one artist. So the lookup is global,
  // NOT scoped to the requesting account — otherwise every account mints its
  // own copy of the same Spotify artist (chat#1889 row 8).
  it("finds the artist globally, not scoped to any account", async () => {
    vi.mocked(selectSocials).mockResolvedValue([{ id: "social-1" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([
      { account_id: "canonical-artist-1" },
    ] as never);

    const found = await findCanonicalArtistBySpotifyId(SPOTIFY_ID);

    expect(found).toBe("canonical-artist-1");
    expect(selectSocials).toHaveBeenCalledWith({ profileUrlContains: SPOTIFY_ID });
  });

  it("returns null when no social carries that Spotify id", async () => {
    vi.mocked(selectSocials).mockResolvedValue([] as never);

    const found = await findCanonicalArtistBySpotifyId(SPOTIFY_ID);

    expect(found).toBeNull();
    expect(selectAccountSocials).not.toHaveBeenCalled();
  });

  it("returns null when the social exists but no artist is linked to it", async () => {
    vi.mocked(selectSocials).mockResolvedValue([{ id: "social-1" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([] as never);

    expect(await findCanonicalArtistBySpotifyId(SPOTIFY_ID)).toBeNull();
  });

  // Never fail a valuation over a dedup lookup: falling back to creating an
  // artist is strictly better than a 500.
  it("returns null when the lookup throws", async () => {
    vi.mocked(selectSocials).mockRejectedValue(new Error("db down"));

    expect(await findCanonicalArtistBySpotifyId(SPOTIFY_ID)).toBeNull();
  });
  // The chat add flow creates its own artist row (+ Spotify social) BEFORE the
  // fire-and-forget valuation runs. If the global lookup then resolves a
  // DIFFERENT canonical, insertAccountArtistId links that one too and the
  // account shows two roster entries again — reproduced live on chat#1900
  // after api#791 merged. An artist the account already rosters must win.
  it("prefers an artist the requesting account already rosters", async () => {
    vi.mocked(selectSocials).mockResolvedValue([
      { id: "social-new" },
      { id: "social-old" },
    ] as never);
    vi.mocked(selectAccountSocials).mockImplementation((async (args: { socialId: string }) => {
      if (args.socialId === "social-new") return [{ account_id: "client-created-1" }];
      return [{ account_id: "old-canonical-1" }];
    }) as never);
    vi.mocked(selectAccountArtistIds).mockResolvedValue([
      { artist_id: "client-created-1" },
    ] as never);

    const found = await findCanonicalArtistBySpotifyId(SPOTIFY_ID, "acct-1");

    expect(found).toBe("client-created-1");
    expect(selectAccountArtistIds).toHaveBeenCalledWith(["acct-1"]);
  });

  it("still resolves the global canonical when the account rosters nothing for the id", async () => {
    vi.mocked(selectSocials).mockResolvedValue([{ id: "social-old" }] as never);
    vi.mocked(selectAccountSocials).mockResolvedValue([{ account_id: "old-canonical-1" }] as never);
    vi.mocked(selectAccountArtistIds).mockResolvedValue([
      { artist_id: "unrelated-artist" },
    ] as never);

    expect(await findCanonicalArtistBySpotifyId(SPOTIFY_ID, "acct-1")).toBe("old-canonical-1");
  });
});
