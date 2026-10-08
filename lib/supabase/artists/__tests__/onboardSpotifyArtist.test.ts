import { describe, it, expect, vi, beforeEach } from "vitest";
import { onboardSpotifyArtist } from "../onboardSpotifyArtist";
const { rpc, single } = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));

describe("onboardSpotifyArtist", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rpc.mockReturnValue({ single });
  });
  it("passes exact case-sensitive identity and explicit organization to the transaction", async () => {
    single.mockResolvedValue({ data: { artist_id: "canonical", created: false } });
    expect(
      await onboardSpotifyArtist({
        accountId: "actor",
        organizationId: "org",
        name: "Name",
        spotifyArtistId: "AbC",
      }),
    ).toEqual({ artist_id: "canonical", created: false });
    expect(rpc).toHaveBeenCalledWith("onboard_spotify_artist", {
      p_account_id: "actor",
      p_organization_id: "org",
      p_name: "Name",
      p_spotify_artist_id: "AbC",
    });
  });
  it.each([
    ["42501", 403],
    ["21000", 409],
    ["PGRST202", 503],
    ["23514", 503],
  ])("fails closed for %s with status %s", async (code, status) => {
    single.mockResolvedValue({ data: null, error: { code, message: "private database details" } });
    await expect(
      onboardSpotifyArtist({ accountId: "actor", name: "Name", spotifyArtistId: "AbC" }),
    ).rejects.toMatchObject({ status });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
