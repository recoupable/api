import { z } from "zod";
import { runContextEnrichment } from "./runContextEnrichment";
const schema = z.strictObject({
  recordingSubjectId: z.uuid(),
  isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/),
  spotifyUrl: z.string().regex(/^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}$/),
  youtubeUrl: z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/),
  storageKey: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  durationSeconds: z.number().positive().max(1200),
  spotifyDurationSeconds: z.number().positive().max(1200),
  verification: z.strictObject({
    method: z.literal("waveform-cross-correlation"),
    correlation: z.number().min(0.95).max(1),
    previewSeconds: z.number().min(15),
    offsetSeconds: z.number().nonnegative(),
  }),
});
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  resolveRecording?: (owner: string, requestId: string, subjectId: string) => Promise<string>;
  verifyFile?: (key: string) => Promise<{ sha256: string; durationSeconds: number; bytes: number }>;
};
/** Server-only registration of an already acquired and waveform-verified recording.
 * Verification evidence must come from the trusted acquisition worker, never a public request body.
 */
export async function collectContextAudioSource(
  actor: string,
  owner: string,
  requestId: string,
  input: z.input<typeof schema>,
  deps: Dependencies,
) {
  const value = schema.parse(input);
  if (
    !value.storageKey.startsWith(`${owner}/context-audio/`) ||
    !/^[a-zA-Z0-9/-]+\.wav$/.test(value.storageKey)
  )
    throw new Error("Audio file must belong to the selected workspace");
  if (
    Math.abs(value.durationSeconds - value.spotifyDurationSeconds) > 2 ||
    value.verification.offsetSeconds + value.verification.previewSeconds >
      value.durationSeconds + 0.1
  )
    throw new Error("Audio duration does not match the full recording");
  const authorize = async () => {
    await deps.authorize(actor, owner);
    const resolve =
      deps.resolveRecording ??
      (await import("@/lib/supabase/context_requests/getContextRecordingIsrc"))
        .getContextRecordingIsrc;
    if ((await resolve(owner, requestId, value.recordingSubjectId)) !== value.isrc)
      throw new Error("ISRC does not match the context recording");
  };
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "verified-audio-source-v1",
      topic: "audio_source",
      subjectId: value.recordingSubjectId,
      provider: "youtube",
      model: "none",
      evidenceKind: "observation",
      input: value,
      sources: [
        {
          url: value.spotifyUrl,
          kind: "provider_metadata",
          content: { isrc: value.isrc, durationSeconds: value.spotifyDurationSeconds },
        },
        {
          url: value.youtubeUrl,
          kind: "audio",
          content: { sha256: value.sha256, verification: value.verification },
        },
      ],
    },
    {
      ...deps,
      authorize,
      call: async () => {
        const verify =
          deps.verifyFile ??
          (await import("@/lib/supabase/storage/getContextAudioFileMetadata"))
            .getContextAudioFileMetadata;
        const file = await verify(value.storageKey);
        if (
          file.sha256 !== value.sha256 ||
          Math.abs(file.durationSeconds - value.durationSeconds) > 0.1
        )
          throw new Error("Stored audio does not match the verified artifact");
        return {
          content: {
            schemaVersion: 1,
            isrc: value.isrc,
            spotifyUrl: value.spotifyUrl,
            youtubeUrl: value.youtubeUrl,
            storage: { bucket: "user-files", key: value.storageKey },
            ...file,
            format: { container: "wav", codec: "pcm_s16le", sampleRate: 16000, channels: 1 },
            verification: value.verification,
            rightsVerified: false,
            limitations: [
              "Preview overlap supports recording identity, not identical mastering or rights ownership.",
              "File availability is checked again when consumed.",
            ],
          },
          coverage: "full",
          trace: { operation: "verify-private-file-and-register", analysisPerformed: false },
          costUsd: null,
          costStatus: "unknown",
        };
      },
    },
  );
}
