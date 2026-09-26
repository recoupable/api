export interface ContextBriefDocument {
  id: string;
  resultId?: string;
  ownerId: string;
  subjectId: string;
  topic: string;
  version: number;
  status: "accepted" | "partial" | "invalid" | "stale" | "withdrawn";
  evidenceKind:
    | "observation"
    | "estimate"
    | "interpretation"
    | "customer_assertion"
    | "creative_proposal";
  text: string;
  sourceVersionIds: string[];
  coverage: "full" | "partial" | "unknown" | "unavailable";
}

export interface ContextBriefSelection {
  ownerId: string;
  subjectIds: string[];
  topics: string[];
  maxCharacters: number;
  requiredCoverage: "full" | "partial";
  withdrawnSourceVersionIds: string[];
}

/** Select bounded, attributed evidence after authorized current-version reads. */
export function selectContextDocuments(
  documents: ContextBriefDocument[],
  request: ContextBriefSelection,
) {
  if (!Number.isSafeInteger(request.maxCharacters) || request.maxCharacters < 1)
    throw new Error("Invalid brief size limit");
  const withdrawn = new Set(request.withdrawnSourceVersionIds);
  const selected: ContextBriefDocument[] = [];
  let characters = 0;
  const candidates = documents.filter(
    doc =>
      doc.ownerId === request.ownerId &&
      request.subjectIds.includes(doc.subjectId) &&
      request.topics.includes(doc.topic) &&
      doc.status === "accepted" &&
      doc.evidenceKind !== "creative_proposal" &&
      doc.sourceVersionIds.length > 0 &&
      !doc.sourceVersionIds.some(id => withdrawn.has(id)) &&
      (doc.coverage === "full" ||
        (request.requiredCoverage === "partial" && doc.coverage === "partial")),
  );
  candidates.sort(
    (a, b) =>
      request.topics.indexOf(a.topic) - request.topics.indexOf(b.topic) ||
      b.version - a.version ||
      a.id.localeCompare(b.id),
  );
  const subjects = new Set<string>();
  for (const doc of candidates) {
    const key = JSON.stringify([doc.subjectId, doc.topic]);
    if (subjects.has(key)) continue;
    subjects.add(key);
    const length = JSON.stringify(doc).length;
    if (characters + length > request.maxCharacters) continue;
    characters += length;
    selected.push(doc);
  }
  return {
    documents: selected,
    characters,
    missingTopics: request.topics.filter(topic => !selected.some(doc => doc.topic === topic)),
  };
}
