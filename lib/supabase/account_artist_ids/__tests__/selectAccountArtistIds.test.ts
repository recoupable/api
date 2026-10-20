import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAccountArtistIds } from "../selectAccountArtistIds";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

const chain = (result: { data: unknown; error: unknown }) => {
  const query = {
    in: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  query.in.mockReturnValue(query);
  vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue(query) } as never);
  return query;
};

describe("selectAccountArtistIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects the artists held by the given accounts", async () => {
    const query = chain({ data: [{ artist_id: "artist" }], error: null });
    await expect(selectAccountArtistIds({ accountIds: ["acct"] })).resolves.toEqual([
      { artist_id: "artist" },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("account_artist_ids");
    expect(query.in).toHaveBeenCalledWith("account_id", ["acct"]);
  });

  it("selects the rows holding the given artists", async () => {
    const query = chain({ data: [{ artist_id: "artist" }], error: null });
    await expect(selectAccountArtistIds({ artistIds: ["artist"] })).resolves.toHaveLength(1);
    expect(query.in).toHaveBeenCalledWith("artist_id", ["artist"]);
    expect(query.in).not.toHaveBeenCalledWith("account_id", expect.anything());
  });

  it("returns [] without querying for an empty id list", async () => {
    await expect(selectAccountArtistIds({ accountIds: [] })).resolves.toEqual([]);
    await expect(selectAccountArtistIds({ artistIds: [] })).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns null on a database error", async () => {
    chain({ data: null, error: { message: "boom" } });
    await expect(selectAccountArtistIds({ artistIds: ["x"] })).resolves.toBeNull();
  });
});
