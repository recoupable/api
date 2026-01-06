import { TranscriptionResult } from "./types";

/**
 * OpenAI Whisper transcription response with verbose_json format.
 */
interface WhisperVerboseResponse {
  text: string;
  language: string;
  segments?: {
    start: number;
    end: number;
    text: string;
  }[];
}

/**
 * Transcribes audio to text using OpenAI Whisper API.
 *
 * @param audioBlob - The audio file as a Blob
 * @param fileName - Original filename (needed for OpenAI API)
 * @returns Transcription result with full text and optional timestamps
 */
export async function transcribeAudio(
  audioBlob: Blob,
  fileName: string,
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // OpenAI expects a File with a name property
  const file = new File([audioBlob], fileName, { type: audioBlob.type });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Transcription failed with status ${response.status}`,
    );
  }

  const data: WhisperVerboseResponse = await response.json();

  // Map OpenAI segments to our chunk format
  const chunks = data.segments?.map((seg) => ({
    timestamp: [seg.start, seg.end] as [number, number],
    text: seg.text,
  }));

  return {
    text: data.text,
    chunks,
    language: data.language,
  };
}

