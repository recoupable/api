/**
 * Generates a standardized email footer HTML.
 *
 * @param roomId - Optional room ID for the chat link. If not provided, only the reply note is shown.
 * @returns HTML string for the email footer.
 */
export function getEmailFooter(roomId?: string): string {
  const replyNote = `
<p style="font-size:12px;color:#6b7280;margin:0 0 4px;">
  Note: you can reply directly to this email to continue the conversation.
</p>`.trim();

  const chatLink = roomId
    ? `
<p style="font-size:12px;color:#6b7280;margin:0;">
  Or continue the conversation on Recoup:
  <a href="https://chat.recoupable.com/chat/${roomId}" target="_blank" rel="noopener noreferrer">
    https://chat.recoupable.com/chat/${roomId}
  </a>
</p>`.trim()
    : "";

  return `
<hr style="margin-top:24px;margin-bottom:16px;border:none;border-top:1px solid #e5e7eb;" />
${replyNote}
${chatLink}`.trim();
}
