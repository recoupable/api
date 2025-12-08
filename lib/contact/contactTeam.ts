import { sendMessage } from "@/lib/telegram/sendMessage";
import type { ContactTeamQuery } from "./validateContactTeamQuery";

export interface ContactTeamResult {
  success: boolean;
  message: string;
}

/**
 * Sends a message to the team via Telegram.
 *
 * @param input - The contact team input parameters
 * @returns The result of sending the message
 */
export async function contactTeam(input: ContactTeamQuery): Promise<ContactTeamResult> {
  try {
    const { message, active_account_email, active_conversation_id, active_conversation_name } =
      input;

    const formattedMessage = `🔔 New Team Contact
From: ${active_account_email || "Unknown"}
Chat: ${active_conversation_name || "No Chat Name"}
Chat ID: ${active_conversation_id || "No Chat ID"}
Time: ${new Date().toISOString()}

Message:
${message}`;

    await sendMessage(formattedMessage);

    return {
      success: true,
      message:
        "Your message has been sent to the team. They will review it and get back to you if needed.",
    };
  } catch (error) {
    console.error("Error sending team contact message:", error);
    return {
      success: false,
      message: "Failed to send message to team. Please try again later.",
    };
  }
}

