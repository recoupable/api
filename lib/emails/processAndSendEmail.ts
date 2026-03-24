import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { selectRoomWithArtist } from "@/lib/supabase/rooms/selectRoomWithArtist";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { NextResponse } from "next/server";
import { marked } from "marked";

export interface ProcessAndSendEmailInput {
  to: string[];
  cc?: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  room_id?: string;
}

export interface ProcessAndSendEmailSuccess {
  success: true;
  message: string;
  id: string;
}

export interface ProcessAndSendEmailError {
  success: false;
  error: string;
}

export type ProcessAndSendEmailResult = ProcessAndSendEmailSuccess | ProcessAndSendEmailError;

/**
 * Shared email processing and sending logic used by both the
 * POST /api/notifications handler and the send_email MCP tool.
 *
 * Handles room lookup, footer generation, markdown-to-HTML conversion,
 * and the Resend API call.
 *
 * @param input
 */
export async function processAndSendEmail(
  input: ProcessAndSendEmailInput,
): Promise<ProcessAndSendEmailResult> {
  const { to, cc = [], subject, text, html = "", headers = {}, room_id } = input;

  const roomData = room_id ? await selectRoomWithArtist(room_id) : null;
  const footer = getEmailFooter(room_id, roomData?.artist_name || undefined);
  const bodyHtml = html || (text ? await marked(text) : "");
  const htmlWithFooter = `${bodyHtml}\n\n${footer}`;

  const result = await sendEmailWithResend({
    from: RECOUP_FROM_EMAIL,
    to,
    cc: cc.length > 0 ? cc : undefined,
    subject,
    html: htmlWithFooter,
    headers,
  });

  if (result instanceof NextResponse) {
    const data = await result.json();
    return {
      success: false,
      error:
        data?.error?.message ||
        `Failed to send email from ${RECOUP_FROM_EMAIL} to ${to.join(", ")}.`,
    };
  }

  return {
    success: true,
    message: `Email sent successfully from ${RECOUP_FROM_EMAIL} to ${to.join(", ")}. CC: ${cc.length > 0 ? cc.join(", ") : "none"}.`,
    id: result.id,
  };
}
