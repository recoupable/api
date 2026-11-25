interface PublicScrapeItem {
  [key: string]: string | number | PublicScrapeItem | PublicScrapeItem[];
}

const links = [
  "url",
  "profileUrl",
  "webVideoUrl",
  "postUrl",
  "videoUrl",
  "channelUrl",
  "inputChannelUrl",
  "linkedinUrl",
  "pageUrl",
  "facebookUrl",
];
const socialHosts = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "threads.com",
  "threads.net",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
];
const counts = [
  "followers",
  "followersCount",
  "followerCount",
  "follower_count",
  "fans",
  "following",
  "followingCount",
  "postsCount",
  "postCount",
  "video",
  "statusesCount",
  "subscribers",
  "numberOfSubscribers",
  "channelTotalVideos",
  "shares",
  "viewCount",
  "views",
  "videoViewCount",
  "videoPlayCount",
  "playCount",
  "likeCount",
  "likesCount",
  "likes",
  "diggCount",
  "commentsCount",
  "commentCount",
  "comments",
  "replyCount",
  "retweetCount",
  "shareCount",
  "sharesCount",
  "reposts",
];
const related = [
  "author",
  "authorMeta",
  "latestPosts",
  "posts",
  "videos",
  "aboutChannelInfo",
  "engagement",
];

/** Project provider data to public links and aggregate counts used by the social tools. */
export function projectPublicScrapeResults(items: unknown[]): PublicScrapeItem[] {
  return items.flatMap(item => project(item, true));
}

function project(item: unknown, includeRelated: boolean): PublicScrapeItem[] {
  if (!item || typeof item !== "object" || Array.isArray(item)) return [];
  const source = item as Record<string, unknown>;
  const result: PublicScrapeItem = {};

  for (const field of links) {
    const value = source[field];
    if (typeof value !== "string" || value.length > 2048) continue;
    try {
      const url = new URL(value);
      const socialHost = socialHosts.some(
        host => url.hostname === host || url.hostname.endsWith(`.${host}`),
      );
      if (url.protocol === "https:" && socialHost && !url.username && !url.password && !url.port) {
        const parameters = new URLSearchParams();
        for (const key of ["v", "story_fbid", "id"]) {
          const parameter = url.searchParams.get(key);
          if (parameter && /^[a-zA-Z0-9_-]{1,64}$/.test(parameter)) parameters.set(key, parameter);
        }
        url.search = parameters.toString();
        url.hash = "";
        result[field] = url.toString();
      }
    } catch {
      // Omit malformed provider URLs.
    }
  }
  for (const field of counts) {
    const value = source[field];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      result[field] = value;
  }
  if (includeRelated) {
    for (const field of related) {
      const value = source[field];
      if (Array.isArray(value)) {
        const projected = value.flatMap(entry => project(entry, false));
        if (projected.length) result[field] = projected;
      } else {
        const projected = project(value, false);
        if (projected.length) result[field] = projected[0];
      }
    }
  }
  return Object.keys(result).length ? [result] : [];
}
