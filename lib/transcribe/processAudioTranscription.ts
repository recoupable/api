import { transcribeAudio } from "./transcribeAudio";
import { formatTranscriptMd } from "./formatTranscriptMd";
import { saveAudioToFiles } from "./saveAudioToFiles";
import { saveTranscriptToFiles } from "./saveTranscriptToFiles";
import { ProcessTranscriptionParams, ProcessTranscriptionResult } from "./types";

/**
 * Fetches audio from URL, transcribes it with OpenAI Whisper, and saves both
 * the original audio and transcript markdown to the customer's files.
 *
 * @param params
 */
export async function processAudioTranscription(
  params: ProcessTranscriptionParams,
): Promise<ProcessTranscriptionResult> {
  const { audioUrl, ownerAccountId, artistAccountId, title, includeTimestamps } = params;

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.statusText}`);
  }

  const audioBlob = await response.blob();
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const ext = getExtensionFromContentType(contentType);
  const timestamp = Date.now();
  const safeTitle = (title || "audio").replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueTitle = `${safeTitle}-${timestamp}`;
  const fileName = `${uniqueTitle}.${ext}`;

  const audioFileRecord = await saveAudioToFiles({
    audioBlob,
    contentType,
    fileName,
    ownerAccountId,
    artistAccountId,
    title: uniqueTitle,
    tags: ["audio", "original"],
  });

  const transcription = await transcribeAudio(audioBlob, fileName);

  const markdown = formatTranscriptMd(transcription, { title, includeTimestamps });

  const transcriptFileRecord = await saveTranscriptToFiles({
    markdown,
    ownerAccountId,
    artistAccountId,
    title: uniqueTitle,
    tags: ["transcription", "generated"],
  });

  return {
    audioFile: {
      id: audioFileRecord.id,
      fileName: audioFileRecord.file_name,
      storageKey: audioFileRecord.storage_key,
    },
    transcriptFile: {
      id: transcriptFileRecord.id,
      fileName: transcriptFileRecord.file_name,
      storageKey: transcriptFileRecord.storage_key,
    },
    text: transcription.text,
    language: transcription.language,
  };
}

/**
 *
 * @param contentType
 */
function getExtensionFromContentType(contentType: string): string {
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("m4a") || contentType.includes("mp4")) return "m4a";
  if (contentType.includes("webm")) return "webm";
  return "mp3";
}
