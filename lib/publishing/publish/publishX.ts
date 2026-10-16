import { executePostAction } from "@/lib/publishing/executePostAction";
import { uploadConnectorFile } from "@/lib/composio/connectors/uploadConnectorFile";
import { findValue } from "@/lib/publishing/findValue";
import type { PublishInput, PublishResult } from "@/lib/publishing/publish/types";

const UPLOAD_ATTEMPTS = 6;
const UPLOAD_RETRY_MS = 5000;

/**
 * X: stage the video, upload it as tweet media (retrying while X processes
 * it), post with the media id, then read the post back.
 *
 * The media must go in `media_media_ids`; a file on the create call is ignored.
 *
 * @param input - Connection and post row.
 * @returns The live URL and whether the text matches.
 */
export async function publishX({ target, post }: PublishInput): Promise<PublishResult> {
  const file = await uploadConnectorFile({
    url: post.video_url,
    toolSlug: "TWITTER_UPLOAD_LARGE_MEDIA",
  });

  let mediaId: string | null = null;
  for (let attempt = 0; attempt < UPLOAD_ATTEMPTS && !mediaId; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, UPLOAD_RETRY_MS));
    const upload = await executePostAction(target, "TWITTER_UPLOAD_LARGE_MEDIA", {
      media: file,
      media_category: "tweet_video",
    }).catch(() => null);
    mediaId = findValue(upload, ["media_id_string", "media_id", "id"]);
  }
  if (!mediaId) throw new Error("X did not accept the video upload");

  const created = await executePostAction(target, "TWITTER_CREATION_OF_A_POST", {
    text: post.description,
    media_media_ids: [mediaId],
  });
  const tweetId = findValue(created, ["id"]);
  if (!tweetId) throw new Error("X did not return a post id");

  const lookup = await executePostAction(target, "TWITTER_POST_LOOKUP_BY_POST_IDS", {
    ids: [tweetId],
  }).catch(() => null);

  return {
    postUrl: `https://x.com/i/status/${tweetId}`,
    textVerified: liveXText(lookup) === post.description,
  };
}

/**
 * The post's text as X stores it, minus the trailing media link X appends and
 * with its HTML entities decoded.
 *
 * @param lookup - TWITTER_POST_LOOKUP_BY_POST_IDS result.
 * @returns The comparable text, or null.
 */
function liveXText(lookup: unknown): string | null {
  const text = findValue(lookup, ["text"]);
  if (text === null) return null;
  return text
    .replace(/\s*https:\/\/t\.co\/\w+$/, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
