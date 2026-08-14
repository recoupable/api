import { describe, it, expect, vi, beforeEach } from "vitest";
import { filterNewPostUrls } from "@/lib/socials/filterNewPostUrls";
import { getPosts } from "@/lib/supabase/posts/getPosts";

vi.mock("@/lib/supabase/posts/getPosts", () => ({ getPosts: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("filterNewPostUrls", () => {
  it("returns only URLs not already stored in posts", async () => {
    vi.mocked(getPosts).mockResolvedValue([{ post_url: "u1" }, { post_url: "u3" }] as never);
    expect(await filterNewPostUrls(["u1", "u2", "u3", "u4"])).toEqual(["u2", "u4"]);
    expect(getPosts).toHaveBeenCalledWith({ postUrls: ["u1", "u2", "u3", "u4"] });
  });

  it("returns every URL when none are stored", async () => {
    vi.mocked(getPosts).mockResolvedValue([] as never);
    expect(await filterNewPostUrls(["u1"])).toEqual(["u1"]);
  });

  it("returns [] for empty input without querying", async () => {
    expect(await filterNewPostUrls([])).toEqual([]);
    expect(getPosts).not.toHaveBeenCalled();
  });
});
