import { resolveAttachmentUrl } from "./resolveAttachmentUrl";

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
 * public URLs for the content pipeline.
 *
 * @param message
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
