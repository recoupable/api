import type { validateCatalogAuditBrief } from "./validateCatalogAuditBrief";
import { catalogAuditPreparationResponseSchema } from "./catalogAuditPreparationResponseSchema";

/** Assemble and validate an unsaved workpaper without I/O or identity generation. */
export function buildCatalogAuditPreparation(
  ownerId: string,
  caseId: string,
  saved: ReturnType<typeof validateCatalogAuditBrief>,
  versionIds: string[],
  versions: { id: string; fingerprint: string }[],
) {
  const brief = saved.brief;
  return catalogAuditPreparationResponseSchema.parse({
    state: "prepared",
    persisted: false,
    external_actions: "unsupported",
    snapshot: {
      schema_version: 1,
      case_id: caseId,
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
