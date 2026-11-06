import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: mocks.from } }));
const { selectContentArtists } = await import("../selectContentArtists");

describe("selectContentArtists", () => {
  const direct = {
    data: [{ artist: { id: "artist-a", name: "North Star" } }],
    error: null,
    count: 1,
  };
  const memberships = { data: [{ organization_id: "org-a" }], error: null, count: 1 };
  const orgArtists = {
    data: [{ artist: { id: "artist-b", name: "South Star" } }],
    error: null,
    count: 1,
  };
  let results: Record<string, unknown>;
  let queries: Record<
    string,
    { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> }
  >;
  beforeEach(() => {
    vi.clearAllMocks();
    results = {
      account_artist_ids: direct,
      account_organization_ids: memberships,
      artist_organization_ids: orgArtists,
    };
    queries = {};
    mocks.from.mockImplementation((table: string) => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(async () => results[table]),
        in: vi.fn(async () => results[table]),
      };
      query.select.mockReturnValue(query);
      queries[table] = query;
      return query;
    });
  });

  it("combines only direct and member-organization artists", async () => {
    expect(await selectContentArtists("account-a")).toEqual([
      direct.data[0].artist,
      orgArtists.data[0].artist,
    ]);
    expect(queries.account_artist_ids.eq).toHaveBeenCalledWith("account_id", "account-a");
    expect(queries.account_organization_ids.eq).toHaveBeenCalledWith("account_id", "account-a");
    expect(queries.artist_organization_ids.in).toHaveBeenCalledWith("organization_id", ["org-a"]);
  });

  it("does not query all organization artists when there are no memberships", async () => {
    results.account_organization_ids = { data: [], error: null, count: 0 };
    expect(await selectContentArtists("account-a")).toEqual([direct.data[0].artist]);
    expect(mocks.from).not.toHaveBeenCalledWith("artist_organization_ids");
  });

  it("deduplicates a single artist shared by both rosters", async () => {
    results.artist_organization_ids = direct;
    expect(await selectContentArtists("account-a")).toEqual([direct.data[0].artist]);
  });

  it.each(["account_artist_ids", "account_organization_ids", "artist_organization_ids"])(
    "does not use a partial roster when %s fails",
    async table => {
      results[table] = { data: null, error: { message: "database unavailable" }, count: null };
      await expect(selectContentArtists("account-a")).rejects.toThrow();
    },
  );

  it.each(["account_artist_ids", "account_organization_ids", "artist_organization_ids"])(
    "rejects server-truncated results from %s",
    async table => {
      results[table] = { ...(results[table] as object), count: 1001 };
      await expect(selectContentArtists("account-a")).rejects.toThrow();
    },
  );

  it("does not silently drop a missing joined artist", async () => {
    results.account_artist_ids = { data: [{ artist: null }], count: 1, error: null };
    await expect(selectContentArtists("account-a")).rejects.toThrow();
  });
});
