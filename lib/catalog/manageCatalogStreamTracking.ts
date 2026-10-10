import { createHash } from "node:crypto";
import type { z } from "zod";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { catalogStreamTrackingSchema } from "./validateCatalogStreamTracking";
import { getCatalogOwnerIds } from "./getCatalogOwnerIds";
import { selectAccountCatalog } from "@/lib/supabase/account_catalogs/selectAccountCatalog";
import { selectCatalogStreamTracking } from "@/lib/supabase/catalog_stream_tracking/selectCatalogStreamTracking";
import { upsertCatalogStreamTracking } from "@/lib/supabase/catalog_stream_tracking/upsertCatalogStreamTracking";
import { selectLatestCatalogStreamRun } from "@/lib/supabase/catalog_stream_runs/selectLatestCatalogStreamRun";
import { startCatalogStreamRun } from "./startCatalogStreamRun";

/** Shared authenticated catalog tracking control for REST and MCP. */
export async function manageCatalogStreamTracking(
  accountId: string,
  input: z.infer<typeof catalogStreamTrackingSchema>,
) {
  const parsed = catalogStreamTrackingSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid tracking request", status: 400 } as const;
  const { catalog_id: catalogId, action } = parsed.data;
  if (
    action !== "status" &&
    (await consumeOAuthRateLimit(
      createHash("sha256").update("catalog-stream-controls").digest("hex"),
      [{ key: createHash("sha256").update(accountId).digest("hex"), limit: 10 }],
    ))
  )
    return { error: "Too many tracking requests", status: 429 } as const;
  const existing = await selectCatalogStreamTracking(catalogId);
  const ownerIds = await getCatalogOwnerIds(accountId);
  const link = await selectAccountCatalog({
    accountIds: ownerIds,
    catalogId,
    throwOnError: true,
  });
  if (!link) return { error: "Catalog not found", status: 404 } as const;
  const sameOwner =
    existing &&
    ownerIds.includes(existing.owner_id) &&
    (await selectAccountCatalog({
      accountIds: [existing.owner_id],
      catalogId,
      throwOnError: true,
    }));
  // Repeated enable is idempotent; explicit pause/re-enable creates a new revision.
  const tracking =
    action === "disable" || (action === "enable" && (!existing?.enabled || !sameOwner))
      ? await upsertCatalogStreamTracking({
          catalog_id: catalogId,
          owner_id: link.account,
          enabled: action === "enable",
        })
      : existing;
  if (action === "refresh" && !tracking?.enabled)
    return { error: "Enable catalog tracking before refreshing", status: 409 } as const;
  const collection =
    action === "enable" || action === "refresh" ? await startCatalogStreamRun(catalogId) : null;
  return {
    data: {
      catalog_id: catalogId,
      provider: "luminate",
      platform: "all_dsps",
      territory: "worldwide",
      metric: "daily_streams",
      tracking,
      collection,
      latest_run: await selectLatestCatalogStreamRun(catalogId),
    },
  } as const;
}
