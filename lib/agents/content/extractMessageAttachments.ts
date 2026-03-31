import { put } from "@vercel/blob";

interface Attachment {
  type: "image" | "file" | "video" | "audio";
  mimeType?: string;
  name?: string;
  url?: string;
  data?: Buffer | Blob;
  fetchData?: () => Promise<Buffer>;
}

interface MessageWithAttachments {
  attachments?: Attachment[];
}

export interface ExtractedAttachments {
  songUrl: string | null;
  imageUrl: string | null;
}

/**
 * Extracts audio and image attachments from a Slack message and returns
 * public URLs for the content pipeline. Prefers the attachment's direct URL
 * when available; falls back to downloading via fetchData and re-uploading
 * to Vercel Blob storage.
 */
export async function extractMessageAttachments(
  message: MessageWithAttachments,
): Promise<ExtractedAttachments> {
  const result: ExtractedAttachments = {
    songUrl: null,
    imageUrl: null,
  };

  const attachments = message.attachments;
  if (!attachments || attachments.length === 0) {
    return result;
  }

  const isAudio = (a: Attachment) => a.type === "audio" || a.mimeType?.startsWith("audio/");
  const isImage = (a: Attachment) => a.type === "image" || a.mimeType?.startsWith("image/");

  const audioAttachment = attachments.find(isAudio);
  const imageAttachment = attachments.find(isImage);

  if (audioAttachment) {
    try {
      result.songUrl = await resolveAttachmentUrl(audioAttachment, "audio");
    } catch (error) {
      console.error("[content-agent] Failed to resolve audio attachment:", error);
    }
  }

  if (imageAttachment) {
    try {
      result.imageUrl = await resolveAttachmentUrl(imageAttachment, "image");
    } catch (error) {
      console.error("[content-agent] Failed to resolve image attachment:", error);
    }
  }

  return result;
}

/**
 * Downloads a Slack file and uploads to Vercel Blob.
 *
 * Uses Slack's files.info API to get the url_private_download URL,
 * then downloads with Bearer token auth. The attachment.url from the
 * Chat SDK is a thumbnail URL that doesn't serve actual file content.
 */
async function resolveAttachmentUrl(attachment: Attachment, prefix: string): Promise<string | null> {
  let data: Buffer | null = null;
  const token = process.env.SLACK_CONTENT_BOT_TOKEN;

  // Extract Slack file ID from the attachment URL and use files.info API
  if (attachment.url && token) {
    const fileId = extractSlackFileId(attachment.url);
    if (fileId) {
      data = await downloadSlackFile(fileId, token);
    }
  }

  // Fallback to fetchData / data
  if (!data) {
    const raw = attachment.fetchData ? await attachment.fetchData() : attachment.data;
    if (raw) data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as unknown as ArrayBuffer);
  }

  if (!data) {
    console.error(`[content-agent] Could not download attachment "${attachment.name ?? "unknown"}"`);
    return null;
  }

  const filename = attachment.name ?? "attachment";
  const blobPath = `content-attachments/${prefix}/${Date.now()}-${filename}`;
  const contentType = attachment.mimeType ?? (prefix === "audio" ? "audio/mpeg" : "image/png");

  const blob = await put(blobPath, data, { access: "public", contentType });
  console.log(`[content-agent] Uploaded to Blob: ${blob.url}, size=${data.byteLength}`);
  return blob.url;
}

/**
 * Extracts the Slack file ID (e.g. F0APMKTKG9M) from a Slack file URL.
 * URL format: files-tmb/TEAMID-FILEID-HASH/name or files-pri/TEAMID-FILEID/name
 */
function extractSlackFileId(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    // parts[1] is "TEAMID-FILEID-HASH" or "TEAMID-FILEID"
    if (parts.length >= 2) {
      const segments = parts[1].split("-");
      // File ID is the second segment (e.g. F0APMKTKG9M)
      if (segments.length >= 2) {
        return segments[1];
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Downloads a file from Slack using the files.info API to get
 * url_private_download, then fetches the actual file content.
 */
async function downloadSlackFile(fileId: string, token: string): Promise<Buffer | null> {
  console.log(`[content-agent] Fetching file info for ${fileId}`);

  // Get url_private_download from files.info
  const infoResponse = await fetch(`https://slack.com/api/files.info?file=${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!infoResponse.ok) {
    console.error(`[content-agent] files.info failed: ${infoResponse.status}`);
    return null;
  }

  const info = (await infoResponse.json()) as {
    ok: boolean;
    file?: { url_private_download?: string; url_private?: string; size?: number };
    error?: string;
  };

  if (!info.ok || !info.file) {
    console.error(`[content-agent] files.info error: ${info.error ?? "no file"}`);
    return null;
  }

  const downloadUrl = info.file.url_private_download ?? info.file.url_private;
  if (!downloadUrl) {
    console.error(`[content-agent] No download URL in files.info response`);
    return null;
  }

  console.log(`[content-agent] Downloading from: ${downloadUrl}, expectedSize=${info.file.size}`);

  // Download the actual file
  const fileResponse = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!fileResponse.ok) {
    console.error(`[content-agent] File download failed: ${fileResponse.status}`);
    return null;
  }

  const contentType = fileResponse.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    console.error(`[content-agent] Got HTML instead of file content`);
    return null;
  }

  const data = Buffer.from(await fileResponse.arrayBuffer());
  console.log(`[content-agent] Downloaded: size=${data.byteLength}, contentType=${contentType}`);
  return data;
}
