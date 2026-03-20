/**
 * Types for the audio transcription feature.
 */

export type { FileRecord } from "@/lib/supabase/files/createFileRecord";

export interface TranscriptionResult {
  text: string;
  chunks?: { timestamp: [number, number]; text: string }[];
  language?: string;
}

export interface TranscriptMdOptions {
  title?: string;
  includeTimestamps?: boolean;
}

export interface SaveFileParams {
  ownerAccountId: string;
  artistAccountId: string;
  title?: string;
  tags?: string[];
}

export interface SaveAudioParams extends SaveFileParams {
  audioBlob: Blob;
  contentType: string;
  fileName: string;
}

export interface SaveTranscriptParams extends SaveFileParams {
  markdown: string;
}

export interface ProcessTranscriptionParams {
  audioUrl: string;
  ownerAccountId: string;
  artistAccountId: string;
  title?: string;
  includeTimestamps?: boolean;
}

export interface FileInfo {
  id: string;
  fileName: string;
  storageKey: string;
}

export interface ProcessTranscriptionResult {
  audioFile: FileInfo;
  transcriptFile: FileInfo;
  text: string;
  language?: string;
}

/**
 * Formats transcription errors into user-friendly messages.
 * Centralizes error message logic to avoid duplication.
 *
 * @param error
 */
export function formatTranscriptionError(error: unknown): { message: string; status: number } {
  const rawMessage = error instanceof Error ? error.message : "Transcription failed";

  if (rawMessage.includes("OPENAI_API_KEY")) {
    return { message: "OpenAI API key is not configured", status: 500 };
  }
  if (rawMessage.includes("fetch audio") || rawMessage.includes("Failed to fetch")) {
    return {
      message: "Could not fetch the audio file. Please check the URL is accessible.",
      status: 400,
    };
  }
  if (rawMessage.includes("25 MB") || rawMessage.includes("file size")) {
    return { message: "Audio file exceeds the 25MB limit", status: 413 };
  }
  if (rawMessage.includes("rate limit")) {
    return { message: "Rate limit exceeded. Please try again later.", status: 429 };
  }

  return { message: rawMessage, status: 500 };
}
