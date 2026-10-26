import { contextBriefSnapshotSchema } from "./contracts/contextBriefResponseSchemas";
import { sameCatalogUuid } from "./sameCatalogUuid";

/** Require complete, unchanged saved company evidence rather than reconstructing missing inputs. */
export function validateCatalogAuditBrief(raw: unknown, ownerId: string, briefId: string) {
  const { snapshot } = contextBriefSnapshotSchema.parse({ snapshot: raw });
  if (
    !sameCatalogUuid(snapshot.id, briefId) ||
    snapshot.state !== "saved" ||
    snapshot.superseded ||
    snapshot.purpose !== "company_onboarding"
  )
    throw new Error("Catalog audit requires a current saved company-onboarding brief");
  const brief = snapshot.brief;
  if (
    brief.purpose !== "company_onboarding" ||
    !brief.documents.length ||
    brief.documents.length > 256 ||
    !brief.text.trim() ||
    brief.text.length > 32000 ||
    brief.text_characters !== brief.text.length ||
    !brief.request_ids.length ||
    brief.request_ids.length > 10 ||
    brief.request_id !== brief.request_ids[0] ||
    new Set(brief.request_ids).size !== brief.request_ids.length ||
    JSON.stringify(brief.input_manifest.requestIds) !== JSON.stringify(brief.request_ids)
  )
    throw new Error("Catalog audit brief evidence is incomplete");
  if (
    new Set(brief.documents.map(doc => doc.id)).size !== brief.documents.length ||
    brief.documents.some(
      doc =>
        !sameCatalogUuid(doc.ownerId, ownerId) || !doc.resultId || !doc.sourceVersionIds.length,
    )
  )
    throw new Error("Catalog audit brief evidence is unavailable");
  const manifest = brief.documents.map(doc => ({
    documentId: doc.id,
    resultId: doc.resultId,
    subjectId: doc.subjectId,
    topic: doc.topic,
    version: doc.version,
    sourceVersionIds: doc.sourceVersionIds,
  }));
  // Both sides use the owning response schema's field order; no partial manifest is accepted.
  if (JSON.stringify(manifest) !== JSON.stringify(brief.input_manifest.documents))
    throw new Error("Catalog audit brief manifest differs from saved evidence");
  return snapshot;
}
