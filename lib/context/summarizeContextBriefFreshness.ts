import type { ContextBriefDocument } from "./selectContextDocuments";

function latestRetrievedAt(doc: ContextBriefDocument) {
  const times = (doc.sources ?? [])
    .map(source => (source.retrievedAt ? Date.parse(source.retrievedAt) : Number.NaN))
    .filter(time => Number.isFinite(time));
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/** Summarize when selected evidence was retrieved; source locations never enter the summary. */
export function summarizeContextBriefFreshness(documents: ContextBriefDocument[]) {
  const perDocument = documents.map(doc => ({
    documentId: doc.id,
    retrievedAt: latestRetrievedAt(doc),
  }));
  const dated = perDocument.flatMap(entry => (entry.retrievedAt ? [entry.retrievedAt] : []));
  return {
    oldestRetrievedAt: dated.length ? dated.reduce((a, b) => (a < b ? a : b)) : null,
    newestRetrievedAt: dated.length ? dated.reduce((a, b) => (a > b ? a : b)) : null,
    documentsWithoutRetrievalDate: perDocument
      .filter(entry => !entry.retrievedAt)
      .map(entry => entry.documentId),
    documents: perDocument,
  };
}
