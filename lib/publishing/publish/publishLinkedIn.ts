import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";
import { escapeLinkedInText } from "@/lib/publishing/escapeLinkedInText";
import type { PublishInput, PublishResult } from "@/lib/publishing/publish/types";

const REST = "https://api.linkedin.com/rest";
const PROCESSING_POLLS = 24;
const PROCESSING_POLL_MS = 5000;

type UploadInstruction = { uploadUrl: string; firstByte: number; lastByte: number };

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
  const owner = post.sub_account_id ?? (await memberUrn(connection));
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
    uploadInstructions: UploadInstruction[];
    thumbnailUploadUrl?: string;
  };

  const etags: string[] = [];
  for (const part of value.uploadInstructions) {
    const response = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: video.slice(part.firstByte, part.lastByte + 1),
    });
    if (!response.ok) throw new Error(`LinkedIn video part upload returned ${response.status}`);
    etags.push(response.headers.get("etag") ?? "");
  }

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
  await waitUntilAvailable(connection, value.video);

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

/**
 * The connected member's person URN.
 *
 * @param connection - LinkedIn connected account id.
 * @returns `urn:li:person:<id>`.
 */
async function memberUrn(connection: string): Promise<string> {
  const me = await proxyLinkedIn(connection, "GET", "https://api.linkedin.com/v2/userinfo");
  if (typeof me.data.sub !== "string")
    throw new Error("LinkedIn member id not found on the connection");
  return `urn:li:person:${me.data.sub}`;
}

/**
 * Download a file the caller published by URL.
 *
 * @param url - Public file URL.
 * @returns The bytes.
 */
async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return response.arrayBuffer();
}

/**
 * Poll the video until LinkedIn has processed it.
 *
 * @param connection - LinkedIn connected account id.
 * @param videoUrn - The uploaded video's URN.
 */
async function waitUntilAvailable(connection: string, videoUrn: string): Promise<void> {
  for (let poll = 0; poll < PROCESSING_POLLS; poll++) {
    const { data } = await proxyLinkedIn(
      connection,
      "GET",
      `${REST}/videos/${encodeURIComponent(videoUrn)}`,
    );
    if (data.status === "AVAILABLE") return;
    if (data.status === "PROCESSING_FAILED")
      throw new Error("LinkedIn could not process the video");
    await new Promise(resolve => setTimeout(resolve, PROCESSING_POLL_MS));
  }
  throw new Error("LinkedIn video was still processing after 2 minutes");
}
