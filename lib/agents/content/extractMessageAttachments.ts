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
 * Resolves a public URL for an attachment. Uses the attachment's direct URL
 * if available (avoids re-upload corruption). Falls back to fetchData + Blob
 * upload for platforms with private URLs.
 */
async function resolveAttachmentUrl(attachment: Attachment, prefix: string): Promise<string | null> {
  // Prefer direct URL — avoids download+reupload corruption
  if (attachment.url) {
    console.log(`[content-agent] Using direct attachment URL: ${attachment.url}`);
    return attachment.url;
  }

  // Fallback: download and upload to Blob
  const data = attachment.fetchData ? await attachment.fetchData() : attachment.data;
  if (!data) {
    console.error(`[content-agent] Attachment "${attachment.name ?? "unknown"}" has no URL or data`);
    return null;
  }

  const filename = attachment.name ?? "attachment";
  const blobPath = `content-attachments/${prefix}/${Date.now()}-${filename}`;
  const blob = await put(blobPath, data, { access: "public" });
  console.log(`[content-agent] Uploaded to Blob: ${blob.url}`);
  return blob.url;
}
