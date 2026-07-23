import { getSnapshotStep } from "@/app/workflows/getSnapshotStep";
import { markSnapshotStep } from "@/app/workflows/markSnapshotStep";
import { fetchChunkStep } from "@/app/workflows/fetchChunkStep";
import { mapAndWriteChunkStep } from "@/app/workflows/mapAndWriteChunkStep";

const CHUNK_SIZE = 100;

/**
 * Durable snapshot capture (recoupable/chat#1791 write path): mark the job
 * running, then per chunk: a fetch step (actor call — result memoized, so
 * mapping retries never re-spend) and a map+write step (identifier bootstrap
 * + measurements; sustained Spotify rate limits escalate to RetryableError
 * for durable rescheduling), then mark done/failed.
 * Started fire-and-forget from `createSnapshot`; observable in the Vercel
 * dashboard like the sibling workflows.
 */
export async function playcountSnapshotWorkflow(snapshotId: string) {
  "use workflow";

  try {
    const snapshot = await getSnapshotStep(snapshotId);
    await markSnapshotStep(snapshotId, { state: "running" });

    const albumIds = snapshot.album_ids ?? [];
    let written = 0;
    for (let i = 0; i < albumIds.length; i += CHUNK_SIZE) {
      const payload = await fetchChunkStep(albumIds.slice(i, i + CHUNK_SIZE));
      written += await mapAndWriteChunkStep(snapshotId, payload);
    }

    await markSnapshotStep(snapshotId, { state: "done" });
    return { success: true as const, measurementsWritten: written };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[playcount-snapshot] Failed for ${snapshotId}:`, message);
    await markSnapshotStep(snapshotId, { state: "failed" });
    return { success: false as const, error: message };
  }
}
