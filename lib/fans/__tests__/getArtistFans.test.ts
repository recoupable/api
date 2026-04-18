import { describe, it, expect, vi, beforeEach } from "vitest";

import { getArtistFans } from "../getArtistFans";

const mockSelectArtistSegments = vi.fn();
const mockSelectFanSocialIds = vi.fn();
const mockSelectSocialsByIds = vi.fn();

vi.mock("@/lib/supabase/artist_segments/selectArtistSegments", () => ({
  selectArtistSegments: (...args: unknown[]) => mockSelectArtistSegments(...args),
}));

vi.mock("@/lib/supabase/fan_segments/selectFanSocialIds", () => ({
  selectFanSocialIds: (...args: unknown[]) => mockSelectFanSocialIds(...args),
}));

vi.mock("@/lib/supabase/socials/selectSocialsByIds", () => ({
  selectSocialsByIds: (...args: unknown[]) => mockSelectSocialsByIds(...args),
}));

const baseParams = {
  artistAccountId: "11111111-1111-4111-8111-111111111111",
  page: 1,
  limit: 20,
};

describe("getArtistFans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated fans on the happy path", async () => {
    const socialIds = Array.from({ length: 45 }, (_, i) => `social-${i}`);

    mockSelectArtistSegments.mockResolvedValue({
      status: "success",
      segmentIds: ["seg-1", "seg-2"],
    });
    mockSelectFanSocialIds.mockResolvedValue({
      status: "success",
      socialIds,
    });
    mockSelectSocialsByIds.mockResolvedValue({
      status: "success",
      socials: [{ id: "social-20" }, { id: "social-21" }],
    });

    const result = await getArtistFans({ ...baseParams, page: 2, limit: 20 });

    expect(mockSelectSocialsByIds).toHaveBeenCalledWith(socialIds.slice(20, 40));
    expect(result.status).toBe("success");
    expect(result.fans).toHaveLength(2);
    expect(result.pagination).toEqual({
      total_count: 45,
      page: 2,
      limit: 20,
      total_pages: 3,
    });
  });

  it("returns empty success envelope when artist has no segments", async () => {
    mockSelectArtistSegments.mockResolvedValue({
      status: "success",
      segmentIds: [],
    });

    const result = await getArtistFans(baseParams);

    expect(mockSelectFanSocialIds).not.toHaveBeenCalled();
    expect(result.status).toBe("success");
    expect(result.fans).toEqual([]);
    expect(result.pagination.total_count).toBe(0);
    expect(result.pagination.total_pages).toBe(0);
  });

  it("returns empty success envelope when there are no fan social ids", async () => {
    mockSelectArtistSegments.mockResolvedValue({
      status: "success",
      segmentIds: ["seg-1"],
    });
    mockSelectFanSocialIds.mockResolvedValue({
      status: "success",
      socialIds: [],
    });

    const result = await getArtistFans(baseParams);

    expect(mockSelectSocialsByIds).not.toHaveBeenCalled();
    expect(result.status).toBe("success");
    expect(result.fans).toEqual([]);
    expect(result.pagination.total_count).toBe(0);
  });

  it("returns error envelope when supabase segments lookup fails", async () => {
    mockSelectArtistSegments.mockResolvedValue({
      status: "error",
      segmentIds: [],
    });

    const result = await getArtistFans(baseParams);

    expect(result.status).toBe("error");
    expect(result.fans).toEqual([]);
    expect(result.pagination.total_count).toBe(0);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
  });

  it("zeroes pagination when selectSocialsByIds errors", async () => {
    mockSelectArtistSegments.mockResolvedValue({
      status: "success",
      segmentIds: ["seg-1"],
    });
    mockSelectFanSocialIds.mockResolvedValue({
      status: "success",
      socialIds: ["social-a", "social-b", "social-c"],
    });
    mockSelectSocialsByIds.mockResolvedValue({
      status: "error",
      socials: [],
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

  it("returns error envelope when fan_segments lookup fails", async () => {
    mockSelectArtistSegments.mockResolvedValue({
      status: "success",
      segmentIds: ["seg-1"],
    });
    mockSelectFanSocialIds.mockResolvedValue({
      status: "error",
      socialIds: [],
    });

    const result = await getArtistFans(baseParams);

    expect(result.status).toBe("error");
    expect(mockSelectSocialsByIds).not.toHaveBeenCalled();
  });
});
