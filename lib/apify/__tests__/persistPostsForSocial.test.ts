import { describe, it, expect, vi, beforeEach } from "vitest";

import { persistPostsForSocial } from "../persistPostsForSocial";
import { upsertPosts } from "@/lib/supabase/posts/upsertPosts";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";

vi.mock("@/lib/supabase/posts/upsertPosts", () => ({ upsertPosts: vi.fn() }));
vi.mock("@/lib/supabase/posts/getPosts", () => ({ getPosts: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/supabase/social_posts/upsertSocialPosts", () => ({ upsertSocialPosts: vi.fn() }));

const PROFILE_URL = "tiktok.com/@brauxelion";
const SOCIAL = { id: "soc-1", profile_url: PROFILE_URL };
const POST_ROWS = [
  {
    post_url: "https://www.tiktok.com/@brauxelion/video/1",
    updated_at: "2026-06-15T19:18:17.000Z",
  },
];
const DB_POSTS = [
  { id: "post-1", post_url: POST_ROWS[0].post_url, updated_at: POST_ROWS[0].updated_at },
];

describe("persistPostsForSocial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPosts).mockResolvedValue(DB_POSTS as never);
    vi.mocked(selectSocials).mockResolvedValue([SOCIAL as never]);
  });

  it("upserts posts and links them to the social row", async () => {
    const result = await persistPostsForSocial({ postRows: POST_ROWS, profileUrl: PROFILE_URL });
    expect(upsertPosts).toHaveBeenCalledWith(POST_ROWS);
    expect(getPosts).toHaveBeenCalledWith({ postUrls: [POST_ROWS[0].post_url] });
    expect(selectSocials).toHaveBeenCalledWith({ profile_url: PROFILE_URL });
    expect(upsertSocialPosts).toHaveBeenCalledWith([
      { post_id: "post-1", social_id: "soc-1", updated_at: DB_POSTS[0].updated_at },
    ]);
    expect(result).toEqual({ posts: DB_POSTS, social: SOCIAL });
  });

  it("no-ops when there are no post rows", async () => {
    const result = await persistPostsForSocial({ postRows: [], profileUrl: PROFILE_URL });
    expect(upsertPosts).not.toHaveBeenCalled();
    expect(upsertSocialPosts).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: [], social: null });
  });

  it("skips linking when the social row is not found", async () => {
    vi.mocked(selectSocials).mockResolvedValue([]);
    const result = await persistPostsForSocial({ postRows: POST_ROWS, profileUrl: PROFILE_URL });
    expect(upsertPosts).toHaveBeenCalledWith(POST_ROWS);
    expect(upsertSocialPosts).not.toHaveBeenCalled();
    expect(result).toEqual({ posts: DB_POSTS, social: null });
  });
});
