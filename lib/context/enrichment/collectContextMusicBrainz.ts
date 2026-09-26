import { z } from "zod";
import { lookupMusicBrainzIsrc } from "../providers/lookupMusicBrainzIsrc";
import { runContextEnrichment } from "./runContextEnrichment";
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  resolveRecording?: (owner: string, requestId: string, subjectId: string) => Promise<string>;
  acquirePermit: () => Promise<void>;
  fetcher?: typeof fetch;
};
/** Persist a registry lookup, not confirmed identity. Requires provider-evidence DB migration. */
export async function collectContextMusicBrainz(
  actor: string,
  owner: string,
  requestId: string,
  input: { recordingSubjectId: string; isrc: string; collectionVersion: string },
  deps: Dependencies,
) {
  const recordingSubjectId = z.uuid().parse(input.recordingSubjectId);
  const isrc = z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)
    .parse(input.isrc.replace(/-/g, "").toUpperCase());
  // Supplied by the server's collection policy, never a random automatic retry token.
  const collectionVersion = z.string().min(1).max(100).parse(input.collectionVersion);
  const authorizeRecording = async () => {
    await deps.authorize(actor, owner);
    const resolve =
      deps.resolveRecording ??
      (await import("@/lib/supabase/context_requests/getContextRecordingIsrc"))
        .getContextRecordingIsrc;
    if ((await resolve(owner, requestId, recordingSubjectId)) !== isrc)
      throw new Error("ISRC does not match the context recording");
  };
  const url = `https://musicbrainz.org/ws/2/isrc/${isrc}?fmt=json&inc=artist-credits+releases`;
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "musicbrainz-isrc-v1",
      topic: "musicbrainz_recordings",
      subjectId: recordingSubjectId,
      provider: "musicbrainz",
      model: "none",
      evidenceKind: "observation",
      input: { isrc, collectionVersion },
      // Query provenance here; exact returned source payload is retained in the result trace.
      sources: [
        {
          url,
          kind: "provider_metadata",
          content: { isrc, collectionVersion, role: "lookup_request" },
        },
      ],
    },
    {
      ...deps,
      authorize: authorizeRecording,
      call: async () => {
        const result = await lookupMusicBrainzIsrc(isrc, deps.acquirePermit, deps.fetcher);
        return {
          content: { ...result, identityConfirmed: false },
          coverage: result.status === "not_found" ? "unknown" : "partial",
          trace: result.trace,
          observedSources: [
            {
              url,
              kind: "provider_metadata",
              content: {
                httpStatus: result.trace.httpStatus,
                observedAt: result.trace.startedAt,
                payload: "rawResponse" in result.trace ? result.trace.rawResponse : null,
              },
            },
          ],
          costUsd: null,
          costStatus: "unknown",
        };
      },
    },
  );
}
