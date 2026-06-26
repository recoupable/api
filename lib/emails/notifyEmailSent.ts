import { sendMessage } from "@/lib/telegram/sendMessage";

export interface EmailSentNotification {
  accountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  resendId: string;
}

/**
 * Formats a sent-email notification into a Telegram message.
 *
 * @param n - The sent-email details.
 * @returns A Markdown-formatted message string.
 */
function formatEmailSentMessage(n: EmailSentNotification): string {
  const lines = [
    "*Email sent* (`POST /api/emails`)",
    "",
    `*Account:* ${n.accountId}`,
    `*To:* ${n.to.join(", ")}`,
  ];
  if (n.cc && n.cc.length > 0) {
    lines.push(`*CC:* ${n.cc.join(", ")}`);
  }
  lines.push(`*Subject:* ${n.subject}`);
  lines.push(`*Resend ID:* ${n.resendId}`);
  lines.push("");
  lines.push(`*Time:* ${new Date().toISOString()}`);
  return lines.join("\n");
}

/**
 * Posts an Admin Telegram notification for each email sent (the same
 * `TELEGRAM_CHAT_ID` channel as other alerts), so the team can review the
 * quality and frequency of outgoing email. Best-effort — never throws or
 * blocks the send, mirroring `sendErrorNotification`.
 *
 * @param n - The sent-email details.
 */
export async function notifyEmailSent(n: EmailSentNotification): Promise<void> {
  try {
    await sendMessage(formatEmailSentMessage(n), { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error in notifyEmailSent:", err);
  }
}
