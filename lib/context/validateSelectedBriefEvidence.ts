import { z } from "zod";
import {
  contextBriefSnapshotSchema,
  contextBriefResponseSchema,
} from "./contracts/contextBriefResponseSchemas";
import {
  selectedBriefEvidenceSchema,
  briefEvidenceValidationSchema,
} from "./selectedBriefEvidenceSchema";
import { contextRequestTargetSchema } from "@/lib/supabase/context_requests/contextRequestTargetSchema";
type Row = z.infer<typeof selectedBriefEvidenceSchema>[number];
type UnavailableReason = NonNullable<
  Extract<z.infer<typeof briefEvidenceValidationSchema>, { state: "unavailable" }>["reason"]
>;
const same = (a: Row, b: Row) =>
  a.documentId === b.documentId &&
  a.resultId === b.resultId &&
  a.subjectId === b.subjectId &&
  a.topic === b.topic &&
  a.version === b.version &&
  a.sourceVersionIds.length === b.sourceVersionIds.length &&
  new Set(b.sourceVersionIds).size === b.sourceVersionIds.length &&
  a.sourceVersionIds.every(id => b.sourceVersionIds.includes(id));
const documentSchema = contextBriefResponseSchema.shape.documents.element;
const rowFor = (doc: z.infer<typeof documentSchema>): Row => ({
  documentId: doc.id,
  resultId: doc.resultId ?? null,
  subjectId: doc.subjectId,
  topic: doc.topic,
  version: doc.version,
  sourceVersionIds: doc.sourceVersionIds,
});
/** Bounded, read-only validation against a saved brief and its current request lineage. */
export async function validateSelectedBriefEvidence(input: {
  ownerId: string;
  briefId: string;
  snapshot: unknown;
  selected: Row[];
  explain?: boolean;
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>;
}): Promise<z.infer<typeof briefEvidenceValidationSchema>> {
  // Diagnostic detail is opt-in: strict legacy consumers retain their exact union.
  const unavailable = (reason: UnavailableReason) => ({
    state: "unavailable" as const,
    ...(input.explain === true ? { reason } : {}),
  });
  const parsed = contextBriefSnapshotSchema.safeParse({ snapshot: input.snapshot });
  if (!parsed.success) return unavailable("saved_assessment_unavailable");
  const snapshot = parsed.data.snapshot;
  if (
    snapshot.id !== input.briefId ||
    snapshot.state !== "saved" ||
    snapshot.superseded ||
    snapshot.purpose !== "company_onboarding" ||
    snapshot.brief.purpose !== "company_onboarding"
  )
    return unavailable("saved_assessment_unavailable");
  const brief = snapshot.brief;
  if (brief.input_manifest.requestIds.length > 10) return unavailable("validation_limit_exceeded");
  const requests = z.array(z.uuid()).min(1).max(10).safeParse(brief.input_manifest.requestIds);
  if (
    !requests.success ||
    new Set(requests.data).size !== requests.data.length ||
    requests.data.length !== brief.request_ids.length ||
    !requests.data.every(id => brief.request_ids.includes(id))
  )
    return unavailable("saved_assessment_unavailable");
  for (const row of input.selected) {
    const manifests = brief.input_manifest.documents.filter(
      doc => doc.documentId === row.documentId,
    );
    const saved = brief.documents.filter(doc => doc.id === row.documentId);
    if (
      manifests.length !== 1 ||
      saved.length !== 1 ||
      saved[0].ownerId !== input.ownerId ||
      !same(row, manifests[0]) ||
      !same(row, rowFor(saved[0]))
    )
      return unavailable("selection_mismatch");
  }
  const kinds = new Map<string, Set<z.infer<typeof contextRequestTargetSchema>["kind"]>>();
  for (const requestId of requests.data) {
    const scope = { p_owner: input.ownerId, p_request: requestId };
    const raw = await input.rpc("read_context_documents", scope);
    if (!Array.isArray(raw)) return unavailable("current_evidence_unavailable");
    if (raw.length > 1000) return unavailable("validation_limit_exceeded");
    const rawTargets = await input.rpc("list_context_request_targets", scope);
    if (Array.isArray(rawTargets) && rawTargets.length > 100)
      return unavailable("validation_limit_exceeded");
    const targets = z.array(contextRequestTargetSchema).max(100).safeParse(rawTargets);
    if (!targets.success) return unavailable("current_evidence_unavailable");
    for (const row of input.selected) {
      const matches = raw.filter(
        doc => doc && typeof doc === "object" && "id" in doc && doc.id === row.documentId,
      );
      if (matches.length === 0) continue;
      if (matches.length !== 1) return unavailable("current_evidence_unavailable");
      const current = documentSchema.safeParse(matches[0]);
      if (
        !current.success ||
        current.data.ownerId !== input.ownerId ||
        !same(row, rowFor(current.data))
      )
        return unavailable("current_evidence_unavailable");
      const lineage = targets.data.filter(target => target.subjectId === row.subjectId);
      if (!lineage.length || lineage.some(target => !target.identityConfirmed))
        return unavailable("identity_unconfirmed");
      const values = kinds.get(row.documentId) ?? new Set();
      for (const target of lineage) values.add(target.kind);
      kinds.set(row.documentId, values);
    }
  }
  const documents = [];
  for (const row of input.selected) {
    const values = kinds.get(row.documentId);
    if (!values) return unavailable("current_evidence_unavailable");
    if (values.size !== 1) return unavailable("identity_unconfirmed");
    documents.push({
      documentId: row.documentId,
      subjectId: row.subjectId,
      kind: [...values][0],
      identityConfirmed: true as const,
      sourceVersionIds: [...row.sourceVersionIds],
    });
  }
  return { state: "available", documents };
}
