import { executePostAction } from "@/lib/publishing/executePostAction";
import { uploadConnectorFile } from "@/lib/composio/connectors/uploadConnectorFile";
import { findValue } from "@/lib/publishing/findValue";
import { findYouTubeSnippet } from "@/lib/publishing/findYouTubeSnippet";
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

  // snake_case: the camelCase form of this action silently drops `tags`.
  await executePostAction(target, "YOUTUBE_UPDATE_VIDEO", {
    video_id: videoId,
    title: post.title,
    description: metadata.description,
    category_id: MUSIC_CATEGORY,
    privacy_status: post.privacy ?? "public",
    ...(metadata.tags && { tags: metadata.tags }),
  });

  const details = await executePostAction(target, "YOUTUBE_GET_VIDEO_DETAILS_BATCH", {
    id: videoId,
    part: "snippet",
  }).catch(() => null);
  const snippet = findYouTubeSnippet(details);

  return {
    postUrl: `https://www.youtube.com/watch?v=${videoId}`,
    textVerified:
      snippet?.title === post.title && (snippet?.description ?? "") === (post.description ?? ""),
  };
}
