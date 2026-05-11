import { selectAgentTemplates } from "@/lib/supabase/agent_templates/selectAgentTemplates";
import { selectAgentTemplateFavorites } from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";
import {
  buildAgentTemplateResponse,
  type AgentTemplateResponse,
} from "@/lib/agent_templates/buildAgentTemplateResponse";
import { resolveSharedEmailsByTemplateId } from "@/lib/agent_templates/resolveSharedEmailsByTemplateId";

/**
 * Fetches a single agent template by id, shaped for the API with
 * `is_favourite` (for `accountId`) and `shared_emails` (only when the caller
 * is the template's creator) populated. Returns `null` when the template
 * does not exist.
 */
export async function getAgentTemplateForAccount(
  templateId: string,
  accountId: string,
): Promise<AgentTemplateResponse | null> {
  const [rows, favorites] = await Promise.all([
    selectAgentTemplates({ id: templateId }),
    selectAgentTemplateFavorites(accountId),
  ]);
  const row = rows[0];
  if (!row) return null;

  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const isOwner = creator?.id === accountId;
  const sharedEmailsMap =
    row.is_private && isOwner ? await resolveSharedEmailsByTemplateId([row.id]) : {};

  return buildAgentTemplateResponse(row, {
    isFavourite: favorites.some(f => f.template_id === row.id),
    sharedEmails: sharedEmailsMap[row.id] ?? [],
  });
}
