import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";
import { escapeLinkedInText } from "@/lib/publishing/escapeLinkedInText";
import { getLinkedInMemberUrn } from "@/lib/publishing/getLinkedInMemberUrn";
import { fetchBytes } from "@/lib/publishing/fetchBytes";
import { waitForLinkedInVideo } from "@/lib/publishing/waitForLinkedInVideo";
import {
  uploadLinkedInVideoParts,
  type LinkedInUploadInstruction,
} from "@/lib/publishing/uploadLinkedInVideoParts";
import type { PublishInput, PublishResult } from "@/lib/publishing/publish/types";

const REST = "https://api.linkedin.com/rest";

/**
 * LinkedIn native video, as the connected member or as a Page when
 * `sub_account_id` names an organization: initialize the upload, PUT the parts
 * (and the thumbnail) to LinkedIn's pre-signed URLs, finalize, wait for
 * processing, post, then read the commentary back.
 *
 * Runs through Composio's proxy (see proxyLinkedIn). The pre-signed upload
 * URLs need no token, so the bytes go straight to LinkedIn.
 *
 * @param input - Connection and post row.
 * @returns The live URL and whether the commentary matches.
 */
export async function publishLinkedIn({ target, post }: PublishInput): Promise<PublishResult> {
  const connection = target.connectedAccountId;
  const owner = post.sub_account_id ?? (await getLinkedInMemberUrn(connection));
  const video = await fetchBytes(post.video_url);
  const cover = post.cover_url ? await fetchBytes(post.cover_url) : null;

  const init = await proxyLinkedIn(connection, "POST", `${REST}/videos?action=initializeUpload`, {
    initializeUploadRequest: {
      owner,
      fileSizeBytes: video.byteLength,
      uploadCaptions: false,
      uploadThumbnail: Boolean(cover),
    },
  });
  const value = (init.data.value ?? {}) as {
    video: string;
    uploadToken?: string;
    uploadInstructions: LinkedInUploadInstruction[];
    thumbnailUploadUrl?: string;
  };

  const etags = await uploadLinkedInVideoParts(video, value.uploadInstructions);

  if (cover && value.thumbnailUploadUrl) {
    const response = await fetch(value.thumbnailUploadUrl, {
      method: "PUT",
      headers: { "media-type-family": "STILLIMAGE", "Content-Type": "application/octet-stream" },
      body: cover,
    });
    if (!response.ok) throw new Error(`LinkedIn thumbnail upload returned ${response.status}`);
  }

  await proxyLinkedIn(connection, "POST", `${REST}/videos?action=finalizeUpload`, {
    finalizeUploadRequest: {
      video: value.video,
      uploadToken: value.uploadToken ?? "",
      uploadedPartIds: etags,
    },
  });
  await waitForLinkedInVideo(connection, value.video);

  const commentary = escapeLinkedInText(post.description ?? "");
  const created = await proxyLinkedIn(connection, "POST", `${REST}/posts`, {
    author: owner,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: { media: { id: value.video, ...(post.title && { title: post.title }) } },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });
  const postUrn = created.headers["x-restli-id"] ?? (created.data.id as string | undefined);
  if (!postUrn) throw new Error("LinkedIn did not return a post id");

  const live = await proxyLinkedIn(
    connection,
    "GET",
    `${REST}/posts/${encodeURIComponent(postUrn)}`,
  ).catch(() => null);

  return {
    postUrl: `https://www.linkedin.com/feed/update/${postUrn}/`,
    textVerified: live?.data.commentary === commentary,
  };
}
