import { z } from "zod";
import type { ContextBriefDocument } from "../selectContextDocuments";
import { selectContextVideoArtistResearch } from "./selectContextVideoArtistResearch";
import {
  loadContextVideoEvidence,
  type ContextVideoEvidenceReaders,
} from "./loadContextVideoEvidence";
import { projectContextVideoEvidence } from "./projectContextVideoEvidence";

type Dependencies = ContextVideoEvidenceReaders & {
  authorize: (actor: string, owner: string) => Promise<unknown>;
  readArtistDocuments: (
    owner: string,
    artistSubjectIds: string[],
  ) => Promise<{
    documents: ContextBriefDocument[];
    withdrawnSourceVersionIds: string[];
  }>;
};

/** Authorize, load retained evidence, reuse saved research, then reauthorize before projection. */
export async function prepareContextVideoEvidence(
  actor: string,
  owner: string,
  requestId: string,
  deps: Dependencies,
) {
  actor = z.uuid().parse(actor).toLowerCase();
  owner = z.uuid().parse(owner).toLowerCase();
  requestId = z.uuid().parse(requestId).toLowerCase();
  await deps.authorize(actor, owner);
  const { resourceUrl, evidence } = await loadContextVideoEvidence(owner, requestId, deps);
  let reusedArtistDocuments: ContextBriefDocument[] = [];
  if (evidence.identity.state === "matched") {
    const subjectIds = evidence.identity.creditedArtists.map(artist =>
      artist.subjectId.toLowerCase(),
    );
    const saved = await deps.readArtistDocuments(owner, subjectIds);
    reusedArtistDocuments = selectContextVideoArtistResearch(owner, subjectIds, saved);
  }
  await deps.authorize(actor, owner);
  return { ...projectContextVideoEvidence(resourceUrl, evidence), reusedArtistDocuments };
}
