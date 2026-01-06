import { TranscriptionResult, TranscriptMdOptions } from "./types";

/**
 * Formats a transcription result as a markdown document.
 *
 * @param transcription - The transcription result from OpenAI Whisper
 * @param options - Formatting options (title, timestamps)
 * @returns Formatted markdown string
 */
export function formatTranscriptMd(
  transcription: TranscriptionResult,
  options: TranscriptMdOptions = {},
): string {
  const { title = "Transcription", includeTimestamps = false } = options;

  let md = `# ${title}\n\n`;
  md += `---\n\n`;

  if (includeTimestamps && transcription.chunks && transcription.chunks.length > 0) {
    // Format with timestamps
    for (const chunk of transcription.chunks) {
      const [start] = chunk.timestamp;
      const mins = Math.floor(start / 60);
      const secs = Math.floor(start % 60)
        .toString()
        .padStart(2, "0");
      md += `**[${mins}:${secs}]** ${chunk.text.trim()}\n\n`;
    }
  } else {
    // Plain text without timestamps
    md += transcription.text;
  }

  return md;
}

