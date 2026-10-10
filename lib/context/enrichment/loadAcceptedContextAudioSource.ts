import { z } from "zod";

const documentSchema = z.object({
  topic: z.string(),
  status: z.string(),
  subjectId: z.string(),
  resultId: z.string(),
  text: z.string(),
});
const assetSchema = z.object({
  storage: z.object({ bucket: z.literal("user-files"), key: z.string() }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  durationSeconds: z.number().positive(),
  youtubeUrl: z.url(),
  verification: z.looseObject({ method: z.string() }).nullish(),
});
export type AcceptedContextAudioSource = z.infer<typeof assetSchema>;

/**
 * Find the accepted recording audio for one subject inside an authorized Context request. The
 * caller authorizes the actor first; this only reads documents and checks workspace storage.
 * Whether the audio is verified full-song evidence is decided by `resolveSongEvidenceCoverage`.
 *
 * @param rpc - The Context Engine RPC caller.
 * @param owner - Workspace owner the request belongs to.
 * @param requestId - Context request to read documents from.
 * @param subjectId - Recording subject whose audio is required.
 * @returns All request documents, the audio document result ID and its parsed audio asset.
 */
export async function loadAcceptedContextAudioSource(
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  owner: string,
  requestId: string,
  subjectId: string,
): Promise<{
  documents: z.infer<typeof documentSchema>[];
  resultId: string;
  asset: AcceptedContextAudioSource;
}> {
  const documents = z
    .array(documentSchema)
    .parse(await rpc("read_context_documents", { p_owner: owner, p_request: requestId }));
  const document = documents.find(
    d => d.topic === "audio_source" && d.status === "accepted" && d.subjectId === subjectId,
  );
  if (!document) throw new Error("No accepted audio source for this recording");
  const asset = assetSchema.parse(JSON.parse(document.text));
  if (
    !asset.storage.key.startsWith(`${owner}/context-audio/`) ||
    !/^[a-zA-Z0-9/-]+\.wav$/.test(asset.storage.key)
  )
    throw new Error("Audio outside workspace storage");
  return { documents, resultId: document.resultId, asset };
}
