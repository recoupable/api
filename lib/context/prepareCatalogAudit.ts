import { randomUUID } from "node:crypto";
import { readRetainedContextSourceVersions } from "@/lib/supabase/context_source_versions/readRetainedContextSourceVersions";
import { buildCatalogAuditPreparation } from "./buildCatalogAuditPreparation";
import { validateCatalogAuditBrief } from "./validateCatalogAuditBrief";

/** Prepare an unsaved workpaper from retained evidence. No provider, write, or execution occurs. */
export async function prepareCatalogAudit(
  ownerId: string,
  briefId: string,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  recheckOwner: () => Promise<void>,
) {
  const params = { p_owner: ownerId, p_brief: briefId };
  const raw = await rpc("read_context_brief", params);
  await recheckOwner();
  const saved = validateCatalogAuditBrief(raw, ownerId, briefId);
  const brief = saved.brief;
  const versionIds = [
    ...new Set(brief.documents.flatMap(doc => doc.sourceVersionIds).map(id => id.toLowerCase())),
  ];
  const versions = await readRetainedContextSourceVersions(ownerId, versionIds);
  // The authorized brief RPC rechecks every linked source/result after the metadata read.
  const currentRaw = await rpc("read_context_brief", params);
  await recheckOwner();
  const current = validateCatalogAuditBrief(currentRaw, ownerId, briefId);
  if (JSON.stringify(saved) !== JSON.stringify(current))
    throw new Error("Catalog audit evidence changed during preparation");
  return buildCatalogAuditPreparation(ownerId, randomUUID(), saved, versionIds, versions);
}
