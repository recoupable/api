import { describe, it, expect, vi, beforeEach } from "vitest";

import { getArtistFans } from "../getArtistFans";

const mockSelectAccountSocialIds = vi.fn();
const mockSelectSocialFans = vi.fn();

vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: (...args: unknown[]) => mockSelectAccountSocialIds(...args),
}));

vi.mock("@/lib/supabase/social_fans/selectSocialFans", () => ({
  selectSocialFans: (...args: unknown[]) => mockSelectSocialFans(...args),
}));

const baseParams = {
  artistAccountId: "11111111-1111-4111-8111-111111111111",
  page: 1,
  limit: 20,
};

const ARTIST_SOCIAL_IDS = ["social-a", "social-b"];

function makeFanSocial(id: string) {
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

function makeFanRow(id: string) {
  return { fan_social: makeFanSocial(id) };
}

describe("getArtistFans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectAccountSocialIds.mockResolvedValue({
      status: "success",
      socialIds: ARTIST_SOCIAL_IDS,
    });
  });

  it("returns paginated fans on the happy path and forwards pagination + ordering", async () => {
    const rows = [makeFanRow("social-20"), makeFanRow("social-21")];
    mockSelectSocialFans.mockResolvedValue({
      rows,
      totalCount: 45,
    });

    const result = await getArtistFans({ ...baseParams, page: 2, limit: 20 });

    expect(mockSelectAccountSocialIds).toHaveBeenCalledWith(baseParams.artistAccountId);
    expect(mockSelectSocialFans).toHaveBeenCalledWith({
      social_ids: ARTIST_SOCIAL_IDS,
      orderBy: "latest_engagement",
      orderDirection: "desc",
      page: 2,
      limit: 20,
    });
    expect(result.status).toBe("success");
    expect(result.fans).toEqual([makeFanSocial("social-20"), makeFanSocial("social-21")]);
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

    expect(mockSelectSocialFans).not.toHaveBeenCalled();
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
    mockSelectSocialFans.mockResolvedValue({
      rows: [],
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

    expect(mockSelectSocialFans).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
    expect(result.fans).toEqual([]);
    expect(result.pagination).toEqual({
      total_count: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  });

  it("skips rows whose fan_social join is null", async () => {
    mockSelectSocialFans.mockResolvedValue({
      rows: [makeFanRow("social-1"), { fan_social: null }, makeFanRow("social-2")],
      totalCount: 3,
    });

    const result = await getArtistFans(baseParams);

    expect(result.fans).toEqual([makeFanSocial("social-1"), makeFanSocial("social-2")]);
    expect(result.pagination.total_count).toBe(3);
  });

  it("computes total_pages with Math.ceil for uneven totals", async () => {
    mockSelectSocialFans.mockResolvedValue({
      rows: [makeFanRow("social-1")],
      totalCount: 21,
    });

    const result = await getArtistFans({ ...baseParams, page: 2, limit: 20 });

    expect(result.pagination.total_pages).toBe(2);
  });

  it("falls back to the error envelope when a downstream call throws", async () => {
    mockSelectSocialFans.mockRejectedValue(new Error("boom"));

    const result = await getArtistFans(baseParams);

    expect(result.status).toBe("error");
    expect(result.pagination.total_count).toBe(0);
  });
});
