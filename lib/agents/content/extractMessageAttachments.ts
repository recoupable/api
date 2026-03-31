import { put } from "@vercel/blob";

interface Attachment {
  type: "image" | "file" | "video" | "audio";
  name?: string;
  data?: Buffer | Blob;
  fetchData?: () => Promise<Buffer>;
}

interface MessageWithAttachments {
  attachments?: Attachment[];
}

export interface ExtractedAttachments {
  attachedAudioUrl: string | null;
  attachedImageUrl: string | null;
}

/**
 * Extracts audio and image attachments from a Slack message, uploads them
 * to Vercel Blob storage, and returns public URLs for the content pipeline.
 *
 * @param message - The chat message with optional attachments
 * @returns Public URLs for the first audio and first image attachment found
 */
export async function extractMessageAttachments(
  message: MessageWithAttachments,
): Promise<ExtractedAttachments> {
  const result: ExtractedAttachments = {
    attachedAudioUrl: null,
    attachedImageUrl: null,
  };

  const attachments = message.attachments;
  if (!attachments || attachments.length === 0) {
    return result;
  }

  const audioAttachment = attachments.find(a => a.type === "audio");
  const imageAttachment = attachments.find(a => a.type === "image");

  if (audioAttachment) {
    try {
      result.attachedAudioUrl = await uploadAttachment(audioAttachment, "audio");
    } catch (error) {
      console.error("[content-agent] Failed to upload audio attachment:", error);
    }
  }

  if (imageAttachment) {
    try {
      result.attachedImageUrl = await uploadAttachment(imageAttachment, "image");
    } catch (error) {
      console.error("[content-agent] Failed to upload image attachment:", error);
    }
  }

  return result;
}

/**
 * Downloads attachment data and uploads it to Vercel Blob storage.
 *
 * @param attachment
 * @param prefix
 */
async function uploadAttachment(attachment: Attachment, prefix: string): Promise<string | null> {
  const data = attachment.fetchData ? await attachment.fetchData() : attachment.data;

  if (!data) {
    console.error(`[content-agent] Attachment "${attachment.name ?? "unknown"}" has no data`);
    return null;
  }

  const filename = attachment.name ?? "attachment";
  const blobPath = `content-attachments/${prefix}/${Date.now()}-${filename}`;

  const blob = await put(blobPath, data, { access: "public" });
  return blob.url;
}
