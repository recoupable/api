import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { createFileRecord } from "@/lib/supabase/files/createFileRecord";
import { SaveAudioParams, FileRecord } from "./types";

export async function saveAudioToFiles(params: SaveAudioParams): Promise<FileRecord> {
  const { audioBlob, contentType, fileName, ownerAccountId, artistAccountId, title = "Audio" } =
    params;

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `files/${ownerAccountId}/${artistAccountId}/${safeFileName}`;

  await uploadFileByKey(storageKey, audioBlob, {
    contentType,
    upsert: false,
  });

  return createFileRecord({
    ownerAccountId,
    artistAccountId,
    storageKey,
    fileName: safeFileName,
    mimeType: contentType,
    sizeBytes: audioBlob.size,
    description: `Audio file: "${title}"`,
    tags: params.tags || ["audio"],
  });
}
