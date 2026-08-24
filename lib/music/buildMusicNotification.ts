import { CHAT_APP_URL } from "@/lib/const";

/** Keeps a long lyric from flooding the chat; Telegram also caps message length. */
const MAX_LYRICS_LENGTH = 400;

export interface MusicNotificationInput {
  generationId: string;
  accountEmail: string | null;
  prompt: string;
  lyrics: string;
  durationSeconds: number | null;
  status: "completed" | "failed";
  errorMessage?: string | null;
}

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;

/**
 * Formats the admin Telegram message for a finished music generation.
 *
 * Leads with the link, because the point of the message is to go and listen.
 * The song page resolves for any Recoup org member, so the link opens for
 * whoever reads the chat (recoupable/chat#1999).
 *
 * Failures are labelled distinctly. A song that failed after a credit gate is
 * the event actually worth reacting to, and it reads nothing like a success
 * when skimming.
 *
 * @param input - The finished generation.
 * @returns Plain text for `sendMessage`.
 */
export function buildMusicNotification(input: MusicNotificationInput): string {
  const failed = input.status === "failed";
  const who = input.accountEmail ?? "unknown account";
  const length =
    input.durationSeconds === null ? null : `${input.durationSeconds.toFixed(1)}s`;

  return [
    failed ? "🚫 Music generation failed" : "🎵 New song generated",
    `${CHAT_APP_URL}/music/${input.generationId}`,
    `Account: ${who}`,
    length && `Length: ${length}`,
    `Prompt: ${truncate(input.prompt, MAX_LYRICS_LENGTH)}`,
    !failed && `Lyrics: ${truncate(input.lyrics, MAX_LYRICS_LENGTH)}`,
    failed && input.errorMessage && `Reason: ${input.errorMessage}`,
  ]
    .filter(Boolean)
    .join("\n");
}
