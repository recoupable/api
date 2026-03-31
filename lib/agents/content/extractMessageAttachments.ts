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
 * Downloads a Slack file using the bot token and uploads to Vercel Blob.
 * The Chat SDK's fetchData() is broken (returns HTML login page instead of file),
 * so we download directly from attachment.url with the bot token.
 */
async function resolveAttachmentUrl(attachment: Attachment, prefix: string): Promise<string | null> {
  let data: Buffer | null = null;

  // Download directly from Slack using bot token (fetchData returns HTML, not file data)
  if (attachment.url) {
    const token = process.env.SLACK_CONTENT_BOT_TOKEN;
    if (token) {
      const response = await fetch(attachment.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        data = Buffer.from(await response.arrayBuffer());
        console.log(`[content-agent] Downloaded from Slack: ${attachment.url}, size=${data.byteLength}`);
      } else {
        console.error(`[content-agent] Slack download failed: ${response.status} ${response.statusText}`);
      }
    }
  }

  // Fallback to fetchData / data
  if (!data) {
    const raw = attachment.fetchData ? await attachment.fetchData() : attachment.data;
    if (raw) data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as unknown as ArrayBuffer);
  }

  if (!data) {
    console.error(`[content-agent] Attachment "${attachment.name ?? "unknown"}" has no data`);
    return null;
  }

  const filename = attachment.name ?? "attachment";
  const blobPath = `content-attachments/${prefix}/${Date.now()}-${filename}`;
  const contentType = attachment.mimeType ?? (prefix === "audio" ? "audio/mpeg" : "image/png");

  const blob = await put(blobPath, data, { access: "public", contentType });
  console.log(`[content-agent] Uploaded to Blob: ${blob.url}, size=${data.byteLength}`);
  return blob.url;
}
