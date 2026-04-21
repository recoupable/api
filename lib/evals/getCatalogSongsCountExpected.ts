import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
import { getCatalogSongs } from "@/lib/catalog/getCatalogSongs";
import { EVAL_ACCOUNT_ID } from "@/lib/consts";

async function getCatalogSongsCountExpected() {
  try {
    // Call the supabase helper directly (in-process) rather than re-fetching
    // over HTTP. The new `GET /api/accounts/{id}/catalogs` route requires
    // auth; evals run inside the same Next app, so the direct call skips the
    // auth layer and matches the legacy Express behaviour byte-for-byte.
    const catalogs = await selectAccountCatalogs(EVAL_ACCOUNT_ID);

    if (catalogs.length === 0) {
      throw new Error("No catalogs found for account");
    }

    const firstCatalog = catalogs[0];
    const catalogSongs = await getCatalogSongs(firstCatalog.id);

    const count = catalogSongs.pagination.total_count;
    const formattedCount = count.toLocaleString();
    const expected = `The catalog "${firstCatalog.name}" (id: ${firstCatalog.id}) contains ${formattedCount} songs.`;

    return {
      catalogId: firstCatalog.id,
      catalogName: firstCatalog.name,
      count,
      expected,
    };
  } catch (error) {
    console.error("Error fetching catalog songs count:", error);
    const fallbackExpected =
      "Catalog song count data could not be retrieved at this time. Please try again later.";
    return {
      catalogId: "",
      catalogName: "",
      count: 0,
      expected: fallbackExpected,
    };
  }
}

export default getCatalogSongsCountExpected;
