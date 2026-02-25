import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateCreateNotificationBody } from "./validateCreateNotificationBody";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { selectRoomWithArtist } from "@/lib/supabase/rooms/selectRoomWithArtist";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { marked } from "marked";

/**
 * Handler for POST /api/notifications.
 * Sends a notification email via Resend.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * @param request - The request object.
 * @returns A NextResponse with the send result.
 */
export async function createNotificationHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await safeParseJson(request);
  const validated = validateCreateNotificationBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { to, cc = [], subject, text, html = "", headers = {}, room_id } = validated;

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
    return NextResponse.json(
      {
        status: "error",
        error: data?.error?.message || `Failed to send email from ${RECOUP_FROM_EMAIL} to ${to.join(", ")}.`,
      },
      {
        status: 502,
        headers: getCorsHeaders(),
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: `Email sent successfully from ${RECOUP_FROM_EMAIL} to ${to.join(", ")}. CC: ${cc.length > 0 ? cc.join(", ") : "none"}.`,
      id: result.id,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
