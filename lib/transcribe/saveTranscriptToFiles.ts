import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { createFileRecord } from "@/lib/supabase/files/createFileRecord";
import { SaveTranscriptParams, FileRecord } from "./types";

export async function saveTranscriptToFiles(params: SaveTranscriptParams): Promise<FileRecord> {
  const { markdown, ownerAccountId, artistAccountId, title = "Transcription" } = params;

  const safeTitle = title.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${safeTitle}-transcript.md`;
  const storageKey = `files/${ownerAccountId}/${artistAccountId}/${fileName}`;

  const markdownBlob = new Blob([markdown], { type: "text/markdown" });

  await uploadFileByKey(storageKey, markdownBlob, {
    contentType: "text/markdown",
    upsert: false,
  });

  return createFileRecord({
    ownerAccountId,
    artistAccountId,
    storageKey,
    fileName,
    mimeType: "text/markdown",
    sizeBytes: new TextEncoder().encode(markdown).length,
    description: `Transcript for "${title}"`,
    tags: params.tags || ["transcription"],
  });
}
