import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateCreateTemplateBody } from "@/lib/templates/validateCreateTemplateBody";
import { insertTemplate } from "@/lib/supabase/templates/insertTemplate";
import { insertTemplateShares } from "@/lib/supabase/template_shares/insertTemplateShares";
import { selectTemplates } from "@/lib/supabase/templates/selectTemplates";

/**
 * Handler for POST /api/templates.
 *
 * Creates an template owned by the authenticated account. When
 * `is_private=true`, supplied `share_emails` are resolved to accounts and
 * upserted into template_shares.
 */
export async function createTemplateHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await safeParseJson(request);
    const parsedBody = validateCreateTemplateBody(body);
    if (parsedBody instanceof NextResponse) return parsedBody;

    const accountId = authResult.accountId;

    const inserted = await insertTemplate({
      title: parsedBody.title,
      description: parsedBody.description,
      prompt: parsedBody.prompt,
      tags: parsedBody.tags,
      is_private: parsedBody.is_private,
      creator: accountId,
    });

    if (!inserted) {
      return NextResponse.json(
        { status: "error", error: "Failed to create template" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    if (parsedBody.is_private && parsedBody.share_emails.length > 0) {
      await insertTemplateShares(inserted.id, parsedBody.share_emails);
    }

    const [template] = await selectTemplates({ id: inserted.id }, accountId);

    return NextResponse.json(
      { status: "success", template: template ?? null },
      { status: 201, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] createTemplateHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
