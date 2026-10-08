import { describe, it, expect, vi, beforeEach } from "vitest";
import { createArtistInDb } from "../createArtistInDb";
import { createArtistWithRoster } from "@/lib/supabase/artists/createArtistWithRoster";
vi.mock("@/lib/supabase/artists/createArtistWithRoster", () => ({
  createArtistWithRoster: vi.fn(),
}));
describe("createArtistInDb", () => {
  beforeEach(() => vi.resetAllMocks());
  it("returns the atomically committed artist without a second read", async () => {
    const artist = { id: "artist", account_id: "artist", account_info: [{}], account_socials: [] };
    vi.mocked(createArtistWithRoster).mockResolvedValue(artist as never);
    expect(await createArtistInDb("Name", "operator", "org")).toEqual(artist);
    expect(createArtistWithRoster).toHaveBeenCalledWith("Name", "operator", "org");
  });
  it("returns null on transaction failure", async () => {
    vi.mocked(createArtistWithRoster).mockRejectedValue(new Error("rollback"));
    expect(await createArtistInDb("Name", "operator", "org")).toBeNull();
  });
});
