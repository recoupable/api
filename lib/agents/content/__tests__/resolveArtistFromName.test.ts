import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveArtistFromName } from "../resolveArtistFromName";

vi.mock("@/lib/supabase/account_artist_ids/getAccountArtistIds", () => ({
  getAccountArtistIds: vi.fn(),
}));

const { getAccountArtistIds } = await import(
  "@/lib/supabase/account_artist_ids/getAccountArtistIds"
);

/**
 *
 * @param name
 * @param artistId
 */
function createArtistRow(name: string, artistId: string) {
  return {
    artist_id: artistId,
    pinned: false,
    artist_info: { name, id: artistId },
  };
}

describe("resolveArtistFromName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the matching artist_id for an exact name match (case-insensitive)", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([
      createArtistRow("Gatsby Grace", "aaa"),
      createArtistRow("Mac Miller", "bbb"),
    ] as never);

    const result = await resolveArtistFromName("mac miller", "account-1");
    expect(result).toBe("bbb");
  });

  it("returns the closest match when the name is a partial match", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([
      createArtistRow("Gatsby Grace", "aaa"),
      createArtistRow("Mac Miller", "bbb"),
    ] as never);

    const result = await resolveArtistFromName("Mac", "account-1");
    expect(result).toBe("bbb");
  });

  it("returns null when no artists match", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([
      createArtistRow("Gatsby Grace", "aaa"),
    ] as never);

    const result = await resolveArtistFromName("Unknown Artist", "account-1");
    expect(result).toBeNull();
  });

  it("returns null when the account has no artists", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([]);

    const result = await resolveArtistFromName("Mac Miller", "account-1");
    expect(result).toBeNull();
  });

  it("returns null when artistName is empty", async () => {
    const result = await resolveArtistFromName("", "account-1");
    expect(result).toBeNull();
    expect(getAccountArtistIds).not.toHaveBeenCalled();
  });

  it("queries getAccountArtistIds with the correct accountId", async () => {
    vi.mocked(getAccountArtistIds).mockResolvedValue([
      createArtistRow("Gatsby Grace", "aaa"),
    ] as never);

    await resolveArtistFromName("Gatsby", "account-42");
    expect(getAccountArtistIds).toHaveBeenCalledWith({ accountIds: ["account-42"] });
  });
});
