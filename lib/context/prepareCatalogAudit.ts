import { randomUUID } from "node:crypto";
import { readRetainedContextSourceVersions } from "@/lib/supabase/context_source_versions/readRetainedContextSourceVersions";
import { catalogAuditPreparationResponseSchema } from "./catalogAuditPreparationResponseSchema";
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
  return catalogAuditPreparationResponseSchema.parse({
    state: "prepared",
    persisted: false,
    external_actions: "unsupported",
    snapshot: {
      schema_version: 1,
      case_id: randomUUID(),
      workspace_id: ownerId,
      revision: 0,
      scope: "Catalog audit of selected saved evidence",
      sources: Object.fromEntries(
        versions.map(({ id, fingerprint }) => [
          `source:${id}`,
          {
            id: `source:${id}`,
            version: id,
            sha256: fingerprint,
            locator: { kind: "context_source_version", source_version_id: id },
            context_source_version_id: id,
            status: "active",
            evidence_kind: "retained_context_source",
          },
        ]),
      ),
      assessments: {
        "assessment:context": {
          id: "assessment:context",
          stage: "audit",
          status: "partial",
          summary: brief.text,
          source_refs: versionIds.map(id => ({ source_id: `source:${id}`, version: id })),
          rule_version: "context-catalog-audit-v1",
          evidence_gap:
            "This draft covers only selected saved evidence, not a complete company or catalog audit. Review missing topics, omitted or unavailable evidence and rights, ownership, mandates and provider records before taking action. No external verification or collection was performed.",
          data: {
            brief_id: saved.id,
            request_ids: brief.request_ids,
            readiness: brief.readiness,
            missing_topics: brief.missingTopics,
            input_manifest: brief.input_manifest,
            gaps: brief.gaps,
            request_coverage: brief.request_coverage,
          },
        },
      },
      findings: {},
      actions: {},
      attempts: {},
      outcomes: {},
    },
  });
}
