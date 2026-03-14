import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { processAudioTranscription } from "@/lib/transcribe/processAudioTranscription";
import { formatTranscriptionError } from "@/lib/transcribe/types";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const transcribeAudioSchema = z.object({
  audio_url: z.string().url().describe("URL to the audio file (mp3, wav, m4a, webm)"),
  account_id: z.string().uuid().describe("Owner account ID"),
  artist_account_id: z.string().uuid().describe("Artist account ID for file storage"),
  title: z.string().optional().describe("Title for the transcription (used in filename)"),
  include_timestamps: z.boolean().optional().describe("Include timestamps in the transcript"),
});

type TranscribeAudioArgs = z.infer<typeof transcribeAudioSchema>;

/**
 *
 * @param server
 */
export function registerTranscribeAudioTool(server: McpServer): void {
  server.registerTool(
    "transcribe_audio",
    {
      description:
        "Transcribe audio (music, podcast, voice memo) using OpenAI Whisper. Saves both the original audio file and the transcript markdown to the customer's files.",
      inputSchema: transcribeAudioSchema,
    },
    async (args: TranscribeAudioArgs) => {
      try {
        const result = await processAudioTranscription({
          audioUrl: args.audio_url,
          ownerAccountId: args.account_id,
          artistAccountId: args.artist_account_id,
          title: args.title,
          includeTimestamps: args.include_timestamps,
        });

        return getToolResultSuccess({
          success: true,
          message: `Saved "${result.audioFile.fileName}" and "${result.transcriptFile.fileName}"`,
          audioFile: result.audioFile,
          transcriptFile: result.transcriptFile,
          text: result.text,
          language: result.language,
        });
      } catch (error) {
        const { message } = formatTranscriptionError(error);
        return getToolResultError(`Failed to transcribe audio. ${message}`);
      }
    },
  );
}
