import { put } from "@vercel/blob";
import { downloadSlackFile } from "@/lib/slack/downloadSlackFile";
import { extractSlackFileId } from "@/lib/slack/extractSlackFileId";

interface Attachment {
  type: "image" | "file" | "video" | "audio";
  mimeType?: string;
  name?: string;
  url?: string;
  data?: Buffer | Blob;
  fetchData?: () => Promise<Buffer>;
}

/**
 * Resolve Attachment Url.
 *
 * @param attachment - Parameter.
 * @param prefix - Parameter.
 * @returns - Result.
 */
export async function resolveAttachmentUrl(
  attachment: Attachment,
  prefix: string,
): Promise<string | null> {
  let data: Buffer | null = null;
  const token = process.env.SLACK_CONTENT_BOT_TOKEN;

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
    console.error(
      `[content-agent] Could not download attachment "${attachment.name ?? "unknown"}"`,
    );
    return null;
  }

  const filename = attachment.name ?? "attachment";
  const blobPath = `content-attachments/${prefix}/${Date.now()}-${filename}`;
  const contentType = attachment.mimeType ?? (prefix === "audio" ? "audio/mpeg" : "image/png");

  const blob = await put(blobPath, data, { access: "public", contentType });
  return blob.url;
}
