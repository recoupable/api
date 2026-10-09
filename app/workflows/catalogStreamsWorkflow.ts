import { prepareCatalogStreamRunStep } from "./prepareCatalogStreamRunStep";
import { fetchCatalogStreamTrackStep } from "./fetchCatalogStreamTrackStep";
import { writeCatalogStreamTrackStep } from "./writeCatalogStreamTrackStep";
import { markCatalogStreamRunStep } from "./markCatalogStreamRunStep";

/** Durable daily catalog collection. Fetch failures are isolated; persistence failures fail the run. */
export async function catalogStreamsWorkflow(runId: string) {
  "use workflow";
  try {
    const page = await prepareCatalogStreamRunStep(runId);
    let incomplete = false;
    for (const song of page.songs) {
      let result: Awaited<ReturnType<typeof fetchCatalogStreamTrackStep>> | { state: "failed" };
      try {
        result = await fetchCatalogStreamTrackStep(runId, song.isrc);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
          message.includes("Luminate authentication") ||
          message === "Luminate is not configured"
        ) {
          await markCatalogStreamRunStep(runId, "failed", "provider_authentication_failed");
          return;
        }
        result = { state: "failed" };
      }
      incomplete ||= result.state !== "complete";
      if (!(await writeCatalogStreamTrackStep(runId, song.isrc, result))) {
        await markCatalogStreamRunStep(runId, "cancelled");
        return;
      }
    }
    await markCatalogStreamRunStep(runId, incomplete ? "partial" : "complete");
  } catch {
    await markCatalogStreamRunStep(runId, "failed", "collection_failed_or_revoked");
  }
}
