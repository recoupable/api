import { toIsoDate } from "@/lib/apify/toIsoDate";
import type { ApifyInstagramPost } from "@/lib/apify/types";
import type { PostMediaEntry } from "@/lib/posts/PostMediaEntry";

/** Instagram's own carousel limit; anything beyond it is not a real slide. */
const MAX_MEDIA_ENTRIES = 20;

type Candidate = Omit<PostMediaEntry, "position" | "source">;

/**
 * Picks the caption, publish date and media references the Instagram
 * profile actor already reports for one `latestPosts` item
 * (recoupable/app#2132, CE16). Nothing is fetched or analyzed: entries are
 * provider URLs only, reference-only evidence, never bytes or production
 * assets, and the URLs may expire.
 *
 * Missing fields stay null/empty instead of being invented: an absent
 * caption is `null`, an actor-reported empty caption is `""`, an absent or
 * unparseable timestamp is `null`.
 *
 * Order: carousel children first (each with its own kind and dimensions),
 * then the parent cover (`displayUrl`), then the parent `images` list.
 * Duplicate URLs keep the first, most specific occurrence; positions are
 * assigned after deduplication; at most 20 entries are kept.
 */
export function mapInstagramPostMedia(post: Partial<ApifyInstagramPost>) {
  const candidates = [...(post.childPosts ?? []).flatMap(candidatesFor), ...candidatesFor(post)];
  const seen = new Set<string>();
  const media: PostMediaEntry[] = [];
  for (const candidate of candidates) {
    if (media.length >= MAX_MEDIA_ENTRIES) break;
    if (seen.has(candidate.provider_url)) continue;
    seen.add(candidate.provider_url);
    media.push({ position: media.length, ...candidate, source: "apify_instagram" });
  }
  return {
    caption: typeof post.caption === "string" ? post.caption : null,
    published_at: toIsoDate(post.timestamp) ?? null,
    media,
  };
}

function candidatesFor(item: Partial<ApifyInstagramPost>): Candidate[] {
  const kind = kindOf(item.type);
  const out: Candidate[] = [];
  if (isUrl(item.displayUrl)) {
    out.push({
      kind,
      provider_url: item.displayUrl,
      width: dimension(item.dimensionsWidth),
      height: dimension(item.dimensionsHeight),
      alt: typeof item.alt === "string" ? item.alt : null,
    });
  }
  for (const url of item.images ?? []) {
    // The images list carries no per-image dimensions or alt text.
    if (isUrl(url)) out.push({ kind, provider_url: url, width: null, height: null, alt: null });
  }
  return out;
}

function kindOf(type: string | undefined): PostMediaEntry["kind"] {
  if (type === "Image") return "image";
  if (type === "Video") return "video";
  return "unknown";
}

function isUrl(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function dimension(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}
