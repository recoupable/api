import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectArtistOwnerLink } from "../selectArtistOwnerLink";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

const chain = (result: { data: unknown; error: unknown }) => {
  const eq = vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(result) }),
  });
  vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) } as never);
  return eq;
};

describe("selectArtistOwnerLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a link row when an account holds the id as an artist", async () => {
    const eq = chain({ data: { account_id: "owner" }, error: null });
    await expect(selectArtistOwnerLink("artist")).resolves.toEqual({ account_id: "owner" });
    expect(supabase.from).toHaveBeenCalledWith("account_artist_ids");
    expect(eq).toHaveBeenCalledWith("artist_id", "artist");
  });

  it("returns null when no account holds the id as an artist", async () => {
    chain({ data: null, error: null });
    await expect(selectArtistOwnerLink("user")).resolves.toBeNull();
  });

  it("throws on a database error", async () => {
    chain({ data: null, error: { message: "boom" } });
    await expect(selectArtistOwnerLink("x")).rejects.toThrow("boom");
  });
});
