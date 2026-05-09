import { buildSharedEmailsByTemplateId } from "@/lib/supabase/agent_templates/buildSharedEmailsByTemplateId";
import { selectFavoriteTemplateIds } from "@/lib/supabase/agent_templates/selectFavoriteTemplateIds";
import { selectMergedAgentTemplatesForAccount } from "@/lib/supabase/agent_templates/selectMergedAgentTemplatesForAccount";
import type { AgentTemplateRow } from "@/types/AgentTemplates";

function mapSortAgentTemplates(
  merged: Omit<AgentTemplateRow, "is_favourite" | "shared_emails">[],
  favouriteIds: Set<string>,
  emailsByTemplate: Record<string, string[]>,
): AgentTemplateRow[] {
  return merged
    .map(t => ({
      ...t,
      is_favourite: favouriteIds.has(t.id),
      shared_emails: t.is_private ? (emailsByTemplate[t.id] ?? []) : [],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Templates visible to an authenticated account: owned, public, shared-with,
 * plus `is_favourite`. `shared_emails` only for private templates the caller owns.
 */
export async function getAgentTemplatesForAccount(accountId: string): Promise<AgentTemplateRow[]> {
  const [merged, favouriteIds] = await Promise.all([
    selectMergedAgentTemplatesForAccount(accountId),
    selectFavoriteTemplateIds(accountId),
  ]);

  const ownedPrivateIds = merged
    .filter(t => t.is_private && t.creator === accountId)
    .map(t => t.id);

  const emailsByTemplate = await buildSharedEmailsByTemplateId(ownedPrivateIds);

  return mapSortAgentTemplates(merged, favouriteIds, emailsByTemplate);
}
