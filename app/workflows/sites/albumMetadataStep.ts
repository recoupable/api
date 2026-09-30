import { loadSiteAlbum } from "@/lib/sites/production/loadSiteAlbum";
import { FatalError } from "workflow";
export async function albumMetadataStep(...args: Parameters<typeof loadSiteAlbum>) {
  "use step";
  try {
    return await loadSiteAlbum(...args);
  } catch (error) {
    console.error(
      "[sites:albumMetadataStep]",
      error instanceof Error ? error.message : "Unknown failure",
    );
    throw new FatalError(
      "Album track list could not be loaded. No automatic provider retry was attempted.",
    );
  }
}
