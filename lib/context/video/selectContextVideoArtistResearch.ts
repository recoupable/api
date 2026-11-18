import { contextVideoLimits as limits } from "./contextVideoLimits";
import { selectContextDocuments, type ContextBriefDocument } from "../selectContextDocuments";

/** Compare UUIDs canonically while returning the original authorized document objects. */
export function selectContextVideoArtistResearch(
  owner: string,
  subjectIds: string[],
  saved: { documents: ContextBriefDocument[]; withdrawnSourceVersionIds: string[] },
): ContextBriefDocument[] {
  if (
    saved.documents.length > limits.artistDocuments ||
    saved.withdrawnSourceVersionIds.length > limits.withdrawnSourceVersions
  )
    throw new Error("Artist evidence exceeds bounded selection");
  const originals = new Map<ContextBriefDocument, ContextBriefDocument>();
  for (const document of saved.documents.filter(doc => Boolean(doc.resultId))) {
    originals.set(
      {
        ...document,
        ownerId: document.ownerId.toLowerCase(),
        subjectId: document.subjectId.toLowerCase(),
        sourceVersionIds: document.sourceVersionIds.map(id => id.toLowerCase()),
      },
      document,
    );
  }
  return selectContextDocuments([...originals.keys()], {
    ownerId: owner.toLowerCase(),
    subjectIds: subjectIds.map(id => id.toLowerCase()),
    topics: ["artist_research"],
    maxCharacters: limits.artistResearchCharacters,
    requiredCoverage: "partial",
    withdrawnSourceVersionIds: saved.withdrawnSourceVersionIds.map(id => id.toLowerCase()),
  }).documents.map(document => originals.get(document)!);
}
