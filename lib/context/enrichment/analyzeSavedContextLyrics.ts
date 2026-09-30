import { analyzeSavedContextAudio } from "./analyzeSavedContextAudio";
/** Run the lyric preset on saved private audio and persist a separate unverified transcription. */
export async function analyzeSavedContextLyrics(
  actor: string,
  owner: string,
  requestId: string,
  subjectId: string,
  apiKey: string,
  deps: Parameters<typeof analyzeSavedContextAudio>[5],
) {
  return analyzeSavedContextAudio(actor, owner, requestId, subjectId, apiKey, deps, "lyrics");
}
