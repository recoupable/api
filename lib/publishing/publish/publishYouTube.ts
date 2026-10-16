import { executePostAction } from "@/lib/publishing/executePostAction";
import { uploadConnectorFile } from "@/lib/composio/connectors/uploadConnectorFile";
import { findValue } from "@/lib/publishing/findValue";
import type { PublishInput, PublishResult } from "@/lib/publishing/publish/types";

const MUSIC_CATEGORY = "10";

/**
 * YouTube: upload unlisted, then set the final metadata and privacy, then read
 * the snippet back.
 *
 * Metadata is sent again after upload because YouTube can apply the channel's
 * upload defaults while the video processes. No thumbnail call: API-set
 * thumbnails rendered blank on Shorts (owner rule 2026-10-13). A daily-quota
 * 429 surfaces as the thrown error, which the workflow records as `failed`.
 *
 * @param input - Connection and post row.
 * @returns The live URL and whether title and description match.
 */
export async function publishYouTube({ target, post }: PublishInput): Promise<PublishResult> {
  const file = await uploadConnectorFile({
    url: post.video_url,
    toolSlug: "YOUTUBE_MULTIPART_UPLOAD_VIDEO",
  });
  const metadata = {
    title: post.title,
    description: post.description ?? "",
    categoryId: MUSIC_CATEGORY,
    ...(post.tags?.length && { tags: post.tags }),
  };

  const upload = await executePostAction(target, "YOUTUBE_MULTIPART_UPLOAD_VIDEO", {
    ...metadata,
    privacyStatus: "unlisted",
    videoFile: file,
  });
  const video = (upload.video ?? (upload.data as Record<string, unknown> | undefined)?.video) as
    | { id?: string }
    | undefined;
  const videoId = video?.id ?? findValue(upload, ["videoId", "id"]);
  if (!videoId) throw new Error("YouTube did not return a video id");

  await executePostAction(target, "YOUTUBE_UPDATE_VIDEO", {
    videoId,
    ...metadata,
    privacyStatus: post.privacy ?? "public",
  });

  const details = await executePostAction(target, "YOUTUBE_GET_VIDEO_DETAILS_BATCH", {
    id: videoId,
    part: "snippet",
  }).catch(() => null);
  const snippet = findSnippet(details);

  return {
    postUrl: `https://www.youtube.com/watch?v=${videoId}`,
    textVerified:
      snippet?.title === post.title && (snippet?.description ?? "") === (post.description ?? ""),
  };
}

/**
 * The first item's snippet, wherever the envelope nests `items`.
 *
 * @param details - YOUTUBE_GET_VIDEO_DETAILS_BATCH result.
 * @returns The snippet, or null.
 */
function findSnippet(details: unknown): { title?: string; description?: string } | null {
  let current = details;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const record = current as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return (
        (record.items[0] as { snippet?: { title?: string; description?: string } })?.snippet ?? null
      );
    }
    current = record.data ?? record.result ?? record.response;
  }
  return null;
}
