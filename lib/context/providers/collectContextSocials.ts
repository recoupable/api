import { z } from "zod";
import type { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import type { selectPosts } from "@/lib/supabase/posts/selectPosts";
type Dependencies = {
  access: (account: string, artist: string) => Promise<boolean>;
  profiles: typeof selectAccountSocials;
  posts: typeof selectPosts;
};
/** Reuse authorized stored social evidence. Does not start paid scraping or assert profile verification. */
export async function collectContextSocials(
  accountId: string,
  artistId: string,
  page = 1,
  deps?: Dependencies,
) {
  z.uuid().parse(accountId);
  z.uuid().parse(artistId);
  z.number().int().min(1).max(10000).parse(page);
  const d = deps ?? {
    access: async (a: string, b: string) => {
      const { checkAccountArtistAccess } = await import("@/lib/artists/checkAccountArtistAccess");
      return checkAccountArtistAccess(a, b);
    },
    profiles: async (p: Parameters<typeof selectAccountSocials>[0]) => {
      const { selectAccountSocials } = await import(
        "@/lib/supabase/account_socials/selectAccountSocials"
      );
      return selectAccountSocials(p);
    },
    posts: async (p: Parameters<typeof selectPosts>[0]) => {
      const { selectPosts } = await import("@/lib/supabase/posts/selectPosts");
      return selectPosts(p);
    },
  };
  if (!(await d.access(accountId, artistId))) throw new Error("Artist not accessible");
  const start = Date.now(),
    startedAt = new Date().toISOString(),
    limit = 50;
  const [profileRead, postRead] = await Promise.allSettled([
    d.profiles({ accountId: artistId, offset: (page - 1) * limit, limit }),
    d.posts({ artistAccountId: artistId, page, limit }),
  ]);
  const profiles = profileRead.status === "fulfilled" ? profileRead.value : [];
  const result = postRead.status === "fulfilled" ? postRead.value : { posts: [], totalCount: null };
  const gaps = [
    "Post images, videos and captions are not returned by this stored-metrics query.",
    "Linked profiles are not independently verified as official.",
  ];
  if (profileRead.status === "rejected") gaps.push("Saved social profiles could not be read");
  if (postRead.status === "rejected") gaps.push("Saved post metrics could not be read");
  if (profileRead.status === "fulfilled" && !profiles.length && page === 1)
    gaps.push("No linked social profiles");
  if (result.totalCount === 0) gaps.push("No saved post metrics");
  return {
    artistId,
    scope: "workspace_private",
    status: "partial",
    profiles,
    posts: result.posts,
    totalPosts: result.totalCount,
    page,
    nextPostsPage: result.totalCount !== null && page * limit < result.totalCount ? page + 1 : null,
    nextProfilesPage: profiles.length === limit ? page + 1 : null,
    gaps,
    trace: {
      startedAt,
      elapsedMs: Date.now() - start,
      source: "Recoup account_socials/socials/posts",
      executor: "Database reads; no model",
      freshness: "Row update timestamps retained; actual source observation freshness unknown",
    },
  };
}
