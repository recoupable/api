import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { selectPosts } from "../selectPosts";

vi.mock("../../serverClient", () => ({
  default: { from: vi.fn() },
}));

const ARTIST_ID = "11111111-1111-4111-8111-111111111111";

describe("selectPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated posts with inner-join filter and distinct count when artistAccountId is provided", async () => {
    const postRow = {
      id: "p1",
      updated_at: "t",
      social_posts: [{ social: { profile_url: "https://instagram.com/a" } }],
    };
    const rangeMock = vi.fn().mockResolvedValue({ data: [postRow], error: null });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const rowsEq = vi.fn().mockReturnValue({ order: orderMock });
    const rowsSelect = vi.fn().mockReturnValue({ eq: rowsEq });

    const countEq = vi.fn().mockResolvedValue({ count: 7, error: null });
    const countSelect = vi.fn().mockReturnValue({ eq: countEq });

    vi.mocked(supabase.from)
      .mockReturnValueOnce({ select: rowsSelect } as never)
      .mockReturnValueOnce({ select: countSelect } as never);

    const result = await selectPosts({ artistAccountId: ARTIST_ID, page: 2, limit: 5 });

    expect(supabase.from).toHaveBeenNthCalledWith(1, "posts");
    expect(rowsEq).toHaveBeenCalledWith(
      "social_posts.social.account_socials.account_id",
      ARTIST_ID,
    );
    expect(rangeMock).toHaveBeenCalledWith(5, 9);
    expect(countSelect).toHaveBeenCalledWith(expect.stringContaining("account_socials!inner"), {
      count: "exact",
      head: true,
    });
    expect(result).toEqual({ posts: [postRow], totalCount: 7 });
  });

  it("issues a plain posts query when artistAccountId is absent", async () => {
    const postRow = { id: "p1", updated_at: "t" };
    const rangeMock = vi.fn().mockResolvedValue({ data: [postRow], error: null });
    const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
    const rowsSelect = vi.fn().mockReturnValue({ order: orderMock });

    const countSelect = vi.fn().mockResolvedValue({ count: 3, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce({ select: rowsSelect } as never)
      .mockReturnValueOnce({ select: countSelect } as never);

    const result = await selectPosts({ page: 1, limit: 10 });

    expect(rowsSelect).toHaveBeenCalledWith("*");
    expect(orderMock).toHaveBeenCalledWith("updated_at", {
      ascending: false,
      nullsFirst: false,
    });
    expect(rangeMock).toHaveBeenCalledWith(0, 9);
    expect(countSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(result).toEqual({ posts: [postRow], totalCount: 3 });
  });

  it("throws when the rows query errors", async () => {
    const rangeMock = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.mocked(supabase.from)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ range: rangeMock }) }),
        }),
      } as never)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      } as never);

    await expect(selectPosts({ artistAccountId: ARTIST_ID, page: 1, limit: 10 })).rejects.toThrow(
      /Failed to fetch artist posts/,
    );
  });
});
