import { selectOwnedAndPublicAgentTemplates } from "@/lib/supabase/agent_templates/selectOwnedAndPublicAgentTemplates";
import { selectSharedAgentTemplates } from "@/lib/supabase/agent_templates/selectSharedAgentTemplates";
import { selectAgentTemplateFavorites } from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";
import type { AgentTemplateWithCreator } from "@/lib/supabase/agent_templates/agentTemplateWithCreatorSelect";
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
 * shaped for the API response with `creator`, `is_favourite`, and (for
 * private templates the caller owns) `shared_emails` populated.
 *
 * Sharees never see `shared_emails` — only the template's creator does.
 */
export async function getAccessibleAgentTemplatesForAccount(
  accountId: string,
): Promise<AgentTemplateResponse[]> {
  const [ownedAndPublic, shared, favorites] = await Promise.all([
    selectOwnedAndPublicAgentTemplates(accountId),
    selectSharedAgentTemplates(accountId),
    selectAgentTemplateFavorites(accountId),
  ]);

  const byId = new Map<string, AgentTemplateWithCreator>();
  [...ownedAndPublic, ...shared].forEach(row => {
    if (!byId.has(row.id)) byId.set(row.id, row);
  });
  const rows = Array.from(byId.values());

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
