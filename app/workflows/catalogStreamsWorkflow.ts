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
          message === "Catalog stream run revoked" ||
          message === "Recording removed from catalog"
        ) {
          await markCatalogStreamRunStep(runId, "cancelled");
          return;
        }
        if (
          message === "Luminate is not configured" ||
          /^Luminate authentication unavailable \(HTTP \d+\)$/.test(message) ||
          /^Luminate recording unavailable \(HTTP (401|403)\)$/.test(message)
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
  } catch (error) {
    console.error("[catalogStreamsWorkflow] collection failed", { runId });
    if (
      error instanceof Error &&
      ["Catalog stream run revoked", "Recording removed from catalog"].includes(error.message)
    ) {
      await markCatalogStreamRunStep(runId, "cancelled");
      return;
    }
    await markCatalogStreamRunStep(runId, "failed", "collection_failed_or_revoked");
  }
}
