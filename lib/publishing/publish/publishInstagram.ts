import { executePostAction } from "@/lib/publishing/executePostAction";
import { findValue } from "@/lib/publishing/findValue";
import type { PublishInput, PublishResult } from "@/lib/publishing/publish/types";

/**
 * Instagram Reel: create the container (with the cover, if any), publish it
 * once Instagram has processed the video, then read back the permalink and
 * caption.
 *
 * @param input - Connection and post row.
 * @returns The live URL and whether the caption matches.
 */
export async function publishInstagram({ target, post }: PublishInput): Promise<PublishResult> {
  const me = await executePostAction(target, "INSTAGRAM_GET_USER_INFO", {});
  const igUserId = findValue(me, ["id", "user_id"]);
  if (!igUserId) throw new Error("Instagram account id not found on the connection");

  const container = await executePostAction(target, "INSTAGRAM_POST_IG_USER_MEDIA", {
    ig_user_id: igUserId,
    media_type: "REELS",
    video_url: post.video_url,
    caption: post.description,
    share_to_feed: true,
    ...(post.cover_url && { cover_url: post.cover_url }),
  });
  const creationId = findValue(container, ["id", "creation_id"]);
  if (!creationId) throw new Error("Instagram did not return a media container id");

  const published = await executePostAction(target, "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH", {
    ig_user_id: igUserId,
    creation_id: creationId,
    max_wait_seconds: 150,
    poll_interval_seconds: 5,
  });
  const mediaId = findValue(published, ["id", "media_id"]);
  if (!mediaId) throw new Error("Instagram did not return a media id after publishing");

  // The Reel is live from here on: a failed read-back must not fail the post.
  const media = await executePostAction(target, "INSTAGRAM_GET_IG_MEDIA", {
    ig_media_id: mediaId,
    fields: "permalink,caption",
  }).catch(() => null);
  const username = findValue(me, ["username"]);
  const postUrl =
    findValue(media, ["permalink"]) ??
    (username ? `https://www.instagram.com/${username}/` : "https://www.instagram.com/");

  return { postUrl, textVerified: findValue(media, ["caption"]) === post.description };
}
