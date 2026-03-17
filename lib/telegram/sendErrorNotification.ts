import type { UIMessage } from "ai";
import { sendMessage } from "./sendMessage";
import type { SerializedError } from "@/lib/errors/serializeError";

export interface ErrorContext {
  email?: string;
  roomId?: string;
  messages?: UIMessage[];
  path: string;
  error: SerializedError;
}

/**
 * Formats an error context into a Telegram message.
 *
 * @param context - The error context to format
 * @returns Formatted error message string
 */
function formatErrorMessage(context: ErrorContext): string {
  const { path, error, roomId, email } = context;
  const lines = [`*Error in ${path}*`, "", `*Error:* ${error.name}`, `*Message:* ${error.message}`];

  if (roomId) {
    lines.push(`*Room ID:* ${roomId}`);
  }

  if (email) {
    lines.push(`*Email:* ${email}`);
  }

  lines.push("");
  lines.push(`*Time:* ${new Date().toISOString()}`);

  return lines.join("\n");
}

/**
 * Sends error notification to Telegram.
 * Non-blocking to avoid impacting API operations.
 *
 * @param params - The error context parameters
 */
export async function sendErrorNotification(params: ErrorContext): Promise<void> {
  try {
    const message = formatErrorMessage(params);
    await sendMessage(message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error in sendErrorNotification:", err);
  }
}
