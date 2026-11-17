import { getWorkflowMetadata } from "workflow";
import { readAdmittedPackSnapshot } from "@/lib/content/packs/foundation/readAdmittedPackSnapshot";
import { isPackAssetUsable } from "@/lib/content/packs/isPackAssetUsable";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import type { PackActor, PackFile } from "@/lib/content/packs/packTypes";
export async function signPackFoundationFileStep(actor: PackActor, jobId: string, file: PackFile) {
  "use step";
  const saved = await readAdmittedPackSnapshot(actor, jobId, getWorkflowMetadata().workflowRunId);
  if (
    !file.storage_key.startsWith(`${saved.job.owner_id}/release-packs/`) ||
    file.storage_key.includes("..") ||
    !saved.assets.some(
      a =>
        a.kind === "artwork" &&
        isPackAssetUsable(a) &&
        a.files.some(
          f =>
            f.storage_key === file.storage_key &&
            f.content_type === file.content_type &&
            f.bytes === file.bytes,
        ),
    )
  )
    throw new Error("Foundation signing requires this admitted job's retained usable artwork");
  return createSignedFileUrlByKey({ key: file.storage_key, expiresInSeconds: 3600 });
}
signPackFoundationFileStep.maxRetries = 0;
