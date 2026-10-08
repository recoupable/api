import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveOrCreateArtist } from "../resolveOrCreateArtist";
import { createArtistInDb } from "../createArtistInDb";
import { onboardSpotifyArtist } from "@/lib/supabase/artists/onboardSpotifyArtist";
import { selectAccountWithSocials } from "@/lib/supabase/accounts/selectAccountWithSocials";

vi.mock("../createArtistInDb", () => ({ createArtistInDb: vi.fn() }));
vi.mock("@/lib/supabase/artists/onboardSpotifyArtist", () => ({ onboardSpotifyArtist: vi.fn() }));
vi.mock("@/lib/supabase/accounts/selectAccountWithSocials", () => ({
  selectAccountWithSocials: vi.fn(),
}));

const params = {
  name: "Same Name",
  accountId: "operator",
  organizationId: "label",
  spotifyArtistId: "AbCdEfGhIjKlMnOpQrStUv",
};

describe("resolveOrCreateArtist", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(selectAccountWithSocials).mockResolvedValue({
      id: "canonical",
      name: "Original Name",
    } as never);
  });

  it.each([true, false])("returns the committed canonical identity (created=%s)", async created => {
    vi.mocked(onboardSpotifyArtist).mockResolvedValue({ artist_id: "canonical", created });
    const result = await resolveOrCreateArtist(params);
    expect(onboardSpotifyArtist).toHaveBeenCalledWith(params);
    expect(createArtistInDb).not.toHaveBeenCalled();
    expect(result).toEqual({
      artist: { id: "canonical", account_id: "canonical", name: "Original Name" },
      created,
    });
  });

  it("does not fall back to creating when identity lookup or attachment fails", async () => {
    vi.mocked(onboardSpotifyArtist).mockRejectedValue(new Error("attachment failed"));
    await expect(resolveOrCreateArtist(params)).rejects.toThrow("attachment failed");
    expect(createArtistInDb).not.toHaveBeenCalled();
    expect(selectAccountWithSocials).not.toHaveBeenCalled();
  });

  it("reports readback failure, allowing an idempotent retry", async () => {
    vi.mocked(onboardSpotifyArtist).mockResolvedValue({ artist_id: "canonical", created: false });
    vi.mocked(selectAccountWithSocials).mockResolvedValue(null);
    await expect(resolveOrCreateArtist(params)).rejects.toThrow("read artist");
  });

  it("preserves name-only creation without manufacturing a provider identity", async () => {
    vi.mocked(createArtistInDb).mockResolvedValue({ id: "new", account_id: "new" } as never);
    await resolveOrCreateArtist({ name: "Name", accountId: "operator", organizationId: "label" });
    expect(onboardSpotifyArtist).not.toHaveBeenCalled();
    expect(createArtistInDb).toHaveBeenCalledWith("Name", "operator", "label");
  });
});
