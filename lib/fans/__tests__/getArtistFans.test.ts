import { describe, it, expect, vi, beforeEach } from "vitest";

import { getArtistFans } from "../getArtistFans";

const mockCallGetArtistFans = vi.fn();

vi.mock("@/lib/supabase/rpc/callGetArtistFans", () => ({
  callGetArtistFans: (...args: unknown[]) => mockCallGetArtistFans(...args),
}));

const baseParams = {
  artistAccountId: "11111111-1111-4111-8111-111111111111",
  page: 1,
  limit: 20,
};

function makeFan(id: string) {
  return {
    id,
    username: null,
    avatar: null,
    profile_url: null,
    region: null,
    bio: null,
    followerCount: null,
    followingCount: null,
    updated_at: null,
  };
}

describe("getArtistFans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated fans on the happy path and forwards the offset", async () => {
    const fans = [makeFan("social-20"), makeFan("social-21")];
    mockCallGetArtistFans.mockResolvedValue({
      status: "success",
      fans,
      totalCount: 45,
    });

    const result = await getArtistFans({ ...baseParams, page: 2, limit: 20 });

    expect(mockCallGetArtistFans).toHaveBeenCalledWith({
      artistAccountId: baseParams.artistAccountId,
      limit: 20,
      offset: 20,
    });
    expect(result.status).toBe("success");
    expect(result.fans).toEqual(fans);
    expect(result.pagination).toEqual({
      total_count: 45,
      page: 2,
      limit: 20,
      total_pages: 3,
    });
  });

  it("returns empty success envelope when the RPC returns no rows", async () => {
    mockCallGetArtistFans.mockResolvedValue({
      status: "success",
      fans: [],
      totalCount: 0,
    });

    const result = await getArtistFans(baseParams);

    expect(result.status).toBe("success");
    expect(result.fans).toEqual([]);
    expect(result.pagination).toEqual({
      total_count: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  });

  it("returns error envelope when the RPC call fails", async () => {
    mockCallGetArtistFans.mockResolvedValue({
      status: "error",
      fans: [],
      totalCount: 0,
    });

    const result = await getArtistFans(baseParams);

    expect(result.status).toBe("error");
    expect(result.fans).toEqual([]);
    expect(result.pagination).toEqual({
      total_count: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  });

  it("computes total_pages with Math.ceil for uneven totals", async () => {
    mockCallGetArtistFans.mockResolvedValue({
      status: "success",
      fans: [makeFan("social-1")],
      totalCount: 21,
    });

    const result = await getArtistFans({ ...baseParams, page: 2, limit: 20 });

    expect(result.pagination.total_pages).toBe(2);
  });

  it("falls back to the error envelope when the RPC throws", async () => {
    mockCallGetArtistFans.mockRejectedValue(new Error("boom"));

    const result = await getArtistFans(baseParams);

    expect(result.status).toBe("error");
    expect(result.pagination.total_count).toBe(0);
  });
});
