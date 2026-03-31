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
 * Resolves a public URL for an attachment. Downloads via fetchData and
 * uploads to Vercel Blob with the correct content type.
 */
async function resolveAttachmentUrl(attachment: Attachment, prefix: string): Promise<string | null> {
  const data = attachment.fetchData ? await attachment.fetchData() : attachment.data;
  if (!data) {
    console.error(`[content-agent] Attachment "${attachment.name ?? "unknown"}" has no data`);
    return null;
  }

  const filename = attachment.name ?? "attachment";
  const blobPath = `content-attachments/${prefix}/${Date.now()}-${filename}`;
  const contentType = attachment.mimeType ?? (prefix === "audio" ? "audio/mpeg" : "image/png");

  console.log(`[content-agent] Uploading to Blob: path=${blobPath}, contentType=${contentType}, size=${Buffer.isBuffer(data) ? data.byteLength : (data as Blob).size}`);

  const blob = await put(blobPath, data, {
    access: "public",
    contentType,
  });
  console.log(`[content-agent] Uploaded to Blob: ${blob.url}`);
  return blob.url;
}
