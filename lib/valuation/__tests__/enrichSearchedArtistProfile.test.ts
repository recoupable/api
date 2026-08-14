import { describe, it, expect, vi, beforeEach } from "vitest";

import { enrichSearchedArtistProfile } from "../enrichSearchedArtistProfile";
import { upsertArtistInfoFields } from "@/lib/artists/upsertArtistInfoFields";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import type { SpotifyArtist } from "@/types/spotify.types";

vi.mock("@/lib/artists/upsertArtistInfoFields", () => ({ upsertArtistInfoFields: vi.fn() }));
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({ upsertSocials: vi.fn() }));

const artistId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const spotifyArtistId = "4q3ewBCX7sLwd24euuV69X";
// Normalized key (protocol stripped) — MUST match the row updateArtistSocials
// creates/links, or enrichment lands on an orphan row (chat#1881 P1 regression).
const profileUrl = `open.spotify.com/artist/${spotifyArtistId}`;

const spotifyArtist = {
  id: spotifyArtistId,
  name: "Bad Bunny",
  images: [{ url: "https://i.scdn.co/image/big.jpg", height: 640, width: 640 }],
  followers: { href: "", total: 84000000 },
} as unknown as SpotifyArtist;

describe("enrichSearchedArtistProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the artist avatar and upserts the Spotify social with avatar + follower count", async () => {
    await enrichSearchedArtistProfile({ artistId, spotifyArtistId, spotifyArtist });

    expect(upsertArtistInfoFields).toHaveBeenCalledWith({
      artistId,
      image: "https://i.scdn.co/image/big.jpg",
    });
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: profileUrl,
        username: "Bad Bunny",
        avatar: "https://i.scdn.co/image/big.jpg",
        followerCount: 84000000,
      },
    ]);
  });

  it("still upserts the social (with null avatar) when the profile has no image", async () => {
    const noImage = { ...spotifyArtist, images: [] } as unknown as SpotifyArtist;

    await enrichSearchedArtistProfile({ artistId, spotifyArtistId, spotifyArtist: noImage });

    expect(upsertArtistInfoFields).not.toHaveBeenCalled();
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: profileUrl,
        username: "Bad Bunny",
        avatar: null,
        followerCount: 84000000,
      },
    ]);
  });

  it("never throws — a failed enrichment is best-effort", async () => {
    vi.mocked(upsertSocials).mockRejectedValue(new Error("db down"));

    await expect(
      enrichSearchedArtistProfile({ artistId, spotifyArtistId, spotifyArtist }),
    ).resolves.toBeUndefined();
  });
});
