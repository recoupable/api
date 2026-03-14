import { CREATE_CONTENT_TASK_ID } from "@/lib/const";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { createFileRecord } from "@/lib/supabase/files/createFileRecord";
import { selectFileByStorageKey } from "@/lib/supabase/files/selectFileByStorageKey";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import { isCompletedRun, type TriggerRunLike } from "@/lib/content/isCompletedRun";

type CreateContentOutput = {
  status?: string;
  accountId?: string;
  artistSlug?: string;
  template?: string;
  lipsync?: boolean;
  videoSourceUrl?: string;
  video?: {
    fileId: string;
    storageKey: string;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    signedUrl: string;
  } | null;
};

/**
 * Persists create-content task video output to Supabase storage + files table
 * and returns the run with normalized output.
 *
 * This keeps Supabase writes in API only.
 *
 * @param run
 */
export async function persistCreateContentRunVideo<T extends TriggerRunLike>(run: T): Promise<T> {
  if (run.taskIdentifier !== CREATE_CONTENT_TASK_ID || !isCompletedRun(run)) {
    return run;
  }

  const output = (run.output ?? {}) as CreateContentOutput;
  if (!output.accountId || !output.artistSlug || !output.videoSourceUrl) {
    return run;
  }

  if (output.video?.storageKey) {
    return run;
  }

  const fileName = `${output.artistSlug}-${run.id}.mp4`;
  const storageKey = `content/${output.accountId}/${output.artistSlug}/${fileName}`;

  const existingFile = await selectFileByStorageKey({
    ownerAccountId: output.accountId,
    storageKey,
  });

  if (existingFile) {
    const signedUrl = await createSignedFileUrlByKey({
      key: existingFile.storage_key,
    });

    return {
      ...run,
      output: {
        ...output,
        video: {
          fileId: existingFile.id,
          storageKey: existingFile.storage_key,
          fileName: existingFile.file_name,
          mimeType: existingFile.mime_type,
          sizeBytes: existingFile.size_bytes,
          signedUrl,
        },
      },
    };
  }

  const response = await fetch(output.videoSourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download rendered video: ${response.status} ${response.statusText}`);
  }

  const videoBlob = await response.blob();
  const mimeType = response.headers.get("content-type") || "video/mp4";

  await uploadFileByKey(storageKey, videoBlob, {
    contentType: mimeType,
    upsert: true,
  });

  let createdFile;
  try {
    createdFile = await createFileRecord({
      ownerAccountId: output.accountId,
      // Phase 1: artist account mapping is not wired yet, so we scope to owner account.
      artistAccountId: output.accountId,
      storageKey,
      fileName,
      mimeType,
      sizeBytes: videoBlob.size,
      description: `Content pipeline output for ${output.artistSlug}`,
      tags: ["content", "video", output.template ?? "unknown-template"],
    });
  } catch {
    // Race condition: another request may have created the record. Re-select.
    const raceFile = await selectFileByStorageKey({ ownerAccountId: output.accountId, storageKey });
    if (!raceFile) throw new Error("Failed to create or find file record");
    createdFile = raceFile;
  }

  const signedUrl = await createSignedFileUrlByKey({
    key: createdFile.storage_key,
  });

  return {
    ...run,
    output: {
      ...output,
      video: {
        fileId: createdFile.id,
        storageKey: createdFile.storage_key,
        fileName: createdFile.file_name,
        mimeType: createdFile.mime_type,
        sizeBytes: createdFile.size_bytes,
        signedUrl,
      },
    },
  };
}
