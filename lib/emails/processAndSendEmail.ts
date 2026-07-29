import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";
import { getCatalogValuationDelta } from "@/lib/catalog/getCatalogValuationDelta";
import { buildValuationDeltaSubjectPrefix } from "@/lib/emails/valuationDelta/buildValuationDeltaSubjectPrefix";
import { renderValuationDeltaHero } from "@/lib/emails/valuationDelta/renderValuationDeltaHero";
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
  /** Ownership-checked by the caller — leads the email with the catalog's value delta (chat#1911 row 5). */
  catalog_id?: string;
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
 * POST /api/emails handler and the send_email MCP tool.
 *
 * Handles room lookup, footer generation, markdown-to-HTML conversion,
 * and the Resend API call.
 */
export async function processAndSendEmail(
  input: ProcessAndSendEmailInput,
): Promise<ProcessAndSendEmailResult> {
  const { to, cc = [], subject, text, html = "", headers = {}, room_id, catalog_id } = input;

  const roomData = room_id ? await selectRoomWithArtist(room_id) : null;
  const footer = getEmailFooter(room_id, roomData?.artist_name || undefined);
  let bodyHtml = html || (text ? await marked(text) : "");
  let finalSubject = subject;

  // Lead with the catalog's value delta when the caller asked for it
  // (chat#1911 row 5): subject prefix + hero block above the body. Best-effort
  // by contract — an unowned/empty catalog or a lookup failure sends the email
  // unchanged; the delta must never cost a delivery.
  if (catalog_id) {
    try {
      const delta = await getCatalogValuationDelta({ catalogId: catalog_id });
      if (delta) {
        finalSubject = buildValuationDeltaSubjectPrefix(delta) + subject;
        bodyHtml = renderValuationDeltaHero(delta) + bodyHtml;
      }
    } catch (error) {
      console.error("Valuation delta enrichment failed:", error);
    }
  }
  // Wrap in the shared house-style layout so every outbound email — including
  // the live weekly-report send that flows through here — shares one visual
  // language with the welcome/valuation emails (recoupable/chat#1885
  // consistency pass): Recoup wordmark header, achromatic shadow-as-border
  // card, DESIGN.md font stack, and the existing footer as the layout footer.
  const htmlWithLayout = renderEmailLayout({ bodyHtml, footerHtml: footer });

  const result = await sendEmailWithResend({
    from: RECOUP_FROM_EMAIL,
    to,
    cc: cc.length > 0 ? cc : undefined,
    subject: finalSubject,
    html: htmlWithLayout,
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
