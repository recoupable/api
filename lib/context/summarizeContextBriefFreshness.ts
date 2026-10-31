import type { ContextBriefDocument } from "./selectContextDocuments";

function retrievalTimes(doc: ContextBriefDocument) {
  return (doc.sources ?? []).flatMap(source => {
    const time = source.retrievedAt ? Date.parse(source.retrievedAt) : Number.NaN;
    return Number.isFinite(time) ? [time] : [];
  });
}

const bound = (times: number[], pick: (...values: number[]) => number) =>
  times.length ? new Date(pick(...times)).toISOString() : null;

/** Summarize when selected evidence was retrieved; source locations never enter the summary. */
export function summarizeContextBriefFreshness(documents: ContextBriefDocument[]) {
  const perDocument = documents.map(doc => {
    const times = retrievalTimes(doc);
    return {
      documentId: doc.id,
      oldestRetrievedAt: bound(times, Math.min),
      newestRetrievedAt: bound(times, Math.max),
    };
  });
  // Bound by every dated source so an older source on a multi-source document is not masked.
  const allTimes = documents.flatMap(retrievalTimes);
  return {
    oldestRetrievedAt: bound(allTimes, Math.min),
    newestRetrievedAt: bound(allTimes, Math.max),
    documentsWithoutRetrievalDate: perDocument
      .filter(entry => !entry.newestRetrievedAt)
      .map(entry => entry.documentId),
    documents: perDocument,
  };
}
