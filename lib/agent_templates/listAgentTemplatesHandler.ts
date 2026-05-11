import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  selectAgentTemplates,
  type AgentTemplateWithCreator,
} from "@/lib/supabase/agent_templates/selectAgentTemplates";
import { selectAgentTemplateFavorites } from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";
import { buildAgentTemplateResponse } from "@/lib/agent_templates/buildAgentTemplateResponse";
import { resolveSharedEmailsByTemplateId } from "@/lib/agent_templates/resolveSharedEmailsByTemplateId";

function creatorIdOf(row: AgentTemplateWithCreator): string | null {
  const c = row.creator;
  if (!c) return null;
  return Array.isArray(c) ? (c[0]?.id ?? null) : c.id;
}

/**
 * Handler for GET /api/agent-templates.
 *
 * Returns every agent template the authenticated account can see (own, public,
 * shared) with `creator`, `is_favourite`, and `shared_emails` embedded.
 * `shared_emails` is only populated for private templates the caller owns.
 */
export async function listAgentTemplatesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const accountId = authResult.accountId;

    const [rows, favorites] = await Promise.all([
      selectAgentTemplates({ accessibleTo: accountId }),
      selectAgentTemplateFavorites(accountId),
    ]);

    const favoriteIds = new Set(favorites.map(f => f.template_id));
    const ownedPrivateIds = rows
      .filter(r => r.is_private && creatorIdOf(r) === accountId)
      .map(r => r.id);
    const sharedEmailsMap = await resolveSharedEmailsByTemplateId(ownedPrivateIds);

    const templates = rows.map(row =>
      buildAgentTemplateResponse(row, {
        isFavourite: favoriteIds.has(row.id),
        sharedEmails:
          row.is_private && creatorIdOf(row) === accountId ? (sharedEmailsMap[row.id] ?? []) : [],
      }),
    );

    return NextResponse.json(
      { status: "success", templates },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] listAgentTemplatesHandler:", error);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
