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
 * Slack's attachment.url is a thumbnail/preview URL that returns HTML.
 * We convert it to the download URL format and use the bot token for auth.
 * Pattern: files-tmb/TEAM-FILEID-HASH/name → files-pri/TEAM-FILEID/download/name
 */
async function resolveAttachmentUrl(attachment: Attachment, prefix: string): Promise<string | null> {
  let data: Buffer | null = null;
  const token = process.env.SLACK_CONTENT_BOT_TOKEN;

  if (attachment.url && token) {
    // Convert thumbnail URL to download URL
    const downloadUrl = toSlackDownloadUrl(attachment.url);
    console.log(`[content-agent] Downloading: ${downloadUrl}`);

    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      // Verify we got actual file data, not an HTML page
      if (!contentType.includes("text/html")) {
        data = Buffer.from(await response.arrayBuffer());
        console.log(`[content-agent] Downloaded: size=${data.byteLength}, contentType=${contentType}`);
      } else {
        console.error(`[content-agent] Got HTML instead of file from: ${downloadUrl}`);
      }
    } else {
      console.error(`[content-agent] Download failed: ${response.status} ${response.statusText}`);
    }
  }

  // Fallback to fetchData / data if Slack download didn't work
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
 * Converts a Slack thumbnail/preview URL to the actual file download URL.
 * files-tmb/TEAM-FILEID-HASH/name → files-pri/TEAM-FILEID/download/name
 * files-pri/TEAM-FILEID/name → files-pri/TEAM-FILEID/download/name
 */
function toSlackDownloadUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    // parts: ["files-tmb"|"files-pri", "TEAM-FILEID-HASH", "filename"]
    if (parts.length >= 3) {
      const teamFileId = parts[1];
      const filename = parts[parts.length - 1];
      // Strip trailing hash from team-file ID (e.g. T06-F0AP-eecb5f → T06-F0AP)
      const cleanId = teamFileId.replace(/-[a-f0-9]{10,}$/, "");
      return `https://files.slack.com/files-pri/${cleanId}/download/${filename}`;
    }
  } catch {
    // Fall through to original URL
  }
  return url;
}
