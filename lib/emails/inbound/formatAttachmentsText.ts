import type { EmailAttachment } from "./getEmailAttachments";

/**
 * Formats attachment info as text to append to the email body.
 * This makes download URLs available to the LLM and any tools
 * (sandbox, legacy tools, etc.) via the prompt text.
 *
 * @param attachments - Array of email attachments with download URLs
 * @returns Formatted text block listing attachments, or empty string if none
 */
export function formatAttachmentsText(attachments: EmailAttachment[]): string {
  if (!attachments.length) return "";

  const lines = attachments.map(
    att => `- ${att.filename} (${att.contentType}): ${att.downloadUrl}`,
  );
  return `\n\nAttached files:\n${lines.join("\n")}`;
}
