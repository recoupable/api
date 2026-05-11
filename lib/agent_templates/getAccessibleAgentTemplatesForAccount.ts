import { selectAgentTemplates } from "@/lib/supabase/agent_templates/selectAgentTemplates";
import type { AgentTemplateWithCreator } from "@/lib/supabase/agent_templates/selectAgentTemplates";
import { selectAgentTemplateFavorites } from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";
import {
  buildAgentTemplateResponse,
  type AgentTemplateResponse,
} from "@/lib/agent_templates/buildAgentTemplateResponse";
import { resolveSharedEmailsByTemplateId } from "@/lib/agent_templates/resolveSharedEmailsByTemplateId";

function creatorIdOf(row: AgentTemplateWithCreator): string | null {
  const c = row.creator;
  if (!c) return null;
  return Array.isArray(c) ? (c[0]?.id ?? null) : c.id;
}

/**
 * Returns every agent template visible to `accountId` (own, public, shared),
 * shaped for the API with `creator`, `is_favourite`, and `shared_emails`
 * (only when the caller is the template's creator) populated.
 */
export async function getAccessibleAgentTemplatesForAccount(
  accountId: string,
): Promise<AgentTemplateResponse[]> {
  const [rows, favorites] = await Promise.all([
    selectAgentTemplates({ accessibleTo: accountId }),
    selectAgentTemplateFavorites(accountId),
  ]);

  const favoriteIds = new Set(favorites.map(f => f.template_id));
  const ownedPrivateIds = rows
    .filter(r => r.is_private && creatorIdOf(r) === accountId)
    .map(r => r.id);
  const sharedEmailsMap = await resolveSharedEmailsByTemplateId(ownedPrivateIds);

  return rows.map(row =>
    buildAgentTemplateResponse(row, {
      isFavourite: favoriteIds.has(row.id),
      sharedEmails:
        row.is_private && creatorIdOf(row) === accountId ? (sharedEmailsMap[row.id] ?? []) : [],
    }),
  );
}
