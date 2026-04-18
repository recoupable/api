import { describe, it, expect, vi, beforeEach } from "vitest";

import { getArtistFans } from "../getArtistFans";

const mockSelectAccountSocialIds = vi.fn();
const mockSelectArtistFansPage = vi.fn();

vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: (...args: unknown[]) => mockSelectAccountSocialIds(...args),
}));

vi.mock("@/lib/supabase/social_fans/selectArtistFansPage", () => ({
  selectArtistFansPage: (...args: unknown[]) => mockSelectArtistFansPage(...args),
}));

const baseParams = {
  artistAccountId: "11111111-1111-4111-8111-111111111111",
  page: 1,
  limit: 20,
};

const ARTIST_SOCIAL_IDS = ["social-a", "social-b"];

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
    mockSelectAccountSocialIds.mockResolvedValue({
      status: "success",
      socialIds: ARTIST_SOCIAL_IDS,
    });
  });

  it("returns paginated fans on the happy path and forwards the range", async () => {
    const fans = [makeFan("social-20"), makeFan("social-21")];
    mockSelectArtistFansPage.mockResolvedValue({
      status: "success",
      fans,
      totalCount: 45,
    });

    const result = await getArtistFans({ ...baseParams, page: 2, limit: 20 });

    expect(mockSelectAccountSocialIds).toHaveBeenCalledWith(baseParams.artistAccountId);
    expect(mockSelectArtistFansPage).toHaveBeenCalledWith({
      artistSocialIds: ARTIST_SOCIAL_IDS,
      from: 20,
      to: 39,
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

  it("short-circuits to a success envelope when the artist has no socials", async () => {
    mockSelectAccountSocialIds.mockResolvedValue({
      status: "success",
      socialIds: [],
    });

    const result = await getArtistFans(baseParams);

    expect(mockSelectArtistFansPage).not.toHaveBeenCalled();
    expect(result.status).toBe("success");
    expect(result.fans).toEqual([]);
    expect(result.pagination).toEqual({
      total_count: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  });

  it("returns empty success envelope when the fans page is empty", async () => {
    mockSelectArtistFansPage.mockResolvedValue({
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

  it("returns error envelope when account_socials lookup fails", async () => {
    mockSelectAccountSocialIds.mockResolvedValue({
      status: "error",
      socialIds: [],
    });

    const result = await getArtistFans(baseParams);

    expect(mockSelectArtistFansPage).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.fans).toEqual([]);
    expect(result.pagination).toEqual({
      total_count: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  });

  it("returns error envelope when the fans page query fails", async () => {
    mockSelectArtistFansPage.mockResolvedValue({
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
    mockSelectArtistFansPage.mockResolvedValue({
      status: "success",
      fans: [makeFan("social-1")],
      totalCount: 21,
    });

    const result = await getArtistFans({ ...baseParams, page: 2, limit: 20 });

    expect(result.pagination.total_pages).toBe(2);
  });

  it("falls back to the error envelope when a downstream call throws", async () => {
    mockSelectArtistFansPage.mockRejectedValue(new Error("boom"));

    const result = await getArtistFans(baseParams);

    expect(result.status).toBe("error");
    expect(result.pagination.total_count).toBe(0);
  });
});
