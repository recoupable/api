import type { PresetConfig } from "./types";
import { condenseRepetitions } from "./postProcessors";

/** Full lyric transcription with section headers. */
export const lyricTranscriptionPreset: PresetConfig = {
  name: "lyric_transcription",
  label: "Lyric Transcription",
  description:
    "Transcribes complete lyrics with section headers (Verse, Chorus, Bridge, etc).",
  prompt: `Transcribe the complete lyrics of this song. Format with section headers in brackets like [Verse 1], [Chorus], [Bridge], [Outro]. Include every distinct lyric line. Break lines where the singer naturally pauses.`,
  params: { max_new_tokens: 2048, temperature: 0.1, do_sample: true },
  requiresAudio: true,
  responseFormat: "text",
  parseResponse: (raw) => condenseRepetitions(raw),
};
