import { getFrontendBaseUrl } from "@/lib/composio/getFrontendBaseUrl";

/**
 * Generates a standardized email footer HTML.
 *
 * @param roomId - Optional room ID for the chat link. If not provided, only the reply note is shown.
 * @param artistName - Optional artist name to display in the footer.
 * @returns HTML string for the email footer.
 */
export function getEmailFooter(roomId?: string, artistName?: string): string {
  const chatUrl = roomId ? `${getFrontendBaseUrl()}/chat/${roomId}` : "";
  const artistLine = artistName
    ? `
<p style="font-size:12px;color:#6b7280;margin:0 0 4px;">
  From ${artistName}'s workspace
</p>`.trim()
    : "";

  const replyNote = `
<p style="font-size:12px;color:#6b7280;margin:0 0 4px;">
  Note: you can reply directly to this email to continue the conversation.
</p>`.trim();

  const chatLink = roomId
    ? `
<p style="font-size:12px;color:#6b7280;margin:0;">
  Or continue the conversation on Recoup:
  <a href="${chatUrl}" target="_blank" rel="noopener noreferrer">
    ${chatUrl}
  </a>
</p>`.trim()
    : "";

  return `
<hr style="margin-top:24px;margin-bottom:16px;border:none;border-top:1px solid #e5e7eb;" />
${artistLine}
${replyNote}
${chatLink}`.trim();
}
