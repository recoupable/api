import { z } from "zod";
import type { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import type { selectPosts } from "@/lib/supabase/posts/selectPosts";
import type { selectPostMedia } from "@/lib/supabase/posts/selectPostMedia";
type Dependencies = {
  access: (account: string, artist: string) => Promise<boolean>;
  profiles: typeof selectAccountSocials;
  posts: typeof selectPosts;
  media: typeof selectPostMedia;
};
type MediaRow = Awaited<ReturnType<typeof selectPostMedia>>[number];
const MEDIA_RETENTION =
  "Provider URLs only; no bytes retained; reference-only material, not a production asset; provider URLs may expire; video entries reference the cover still image, not the video";
/**
 * Reuse authorized stored social evidence. Does not start paid scraping or assert profile
 * verification. Retained captions/media (recoupable/app#2132) are merged per post as
 * reference-only provider references; a failed media read keeps the posts and adds a gap.
 */
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
    media: async (p: Parameters<typeof selectPostMedia>[0]) => {
      const { selectPostMedia } = await import("@/lib/supabase/posts/selectPostMedia");
      return selectPostMedia(p);
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
  const mediaRead = await readMedia(
    d.media,
    result.posts.map(p => p.id),
  );
  const posts = result.posts.map(post => withRetainedMedia(post, mediaRead.rows.get(post.id)));
  const unretained = posts.filter(p => p.caption === null && p.media.length === 0).length;
  const gaps = ["Linked profiles are not independently verified as official."];
  if (profileRead.status === "rejected") gaps.push("Saved social profiles could not be read");
  if (postRead.status === "rejected") gaps.push("Saved post metrics could not be read");
  if (mediaRead.failed) gaps.push("Saved post captions/media could not be read");
  else if (unretained > 0)
    gaps.push(
      `${unretained} of ${posts.length} posts have no retained caption/media (scraped before media retention or not reported)`,
    );
  if (profileRead.status === "fulfilled" && !profiles.length && page === 1)
    gaps.push("No linked social profiles");
  if (result.totalCount === 0) gaps.push("No saved post metrics");
  return {
    artistId,
    scope: "workspace_private",
    status: "partial",
    profiles,
    posts,
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
      mediaRetention: MEDIA_RETENTION,
    },
  };
}

async function readMedia(read: Dependencies["media"], postIds: string[]) {
  const rows = new Map<string, MediaRow>();
  if (postIds.length === 0) return { rows, failed: false };
  try {
    for (const row of await read({ postIds })) rows.set(row.id, row);
    return { rows, failed: false };
  } catch {
    // The gap names the failure; the underlying error text stays private.
    return { rows, failed: true };
  }
}

function withRetainedMedia<T extends { id: string }>(post: T, row: MediaRow | undefined) {
  return {
    ...post,
    caption: row?.caption ?? null,
    published_at: row?.published_at ?? null,
    media: Array.isArray(row?.media) ? row.media : [],
    media_observed_at: row?.media_observed_at ?? null,
    usage_status: "reference_only" as const,
    retained_bytes: null,
    provider_url_status: "may_expire" as const,
  };
}
