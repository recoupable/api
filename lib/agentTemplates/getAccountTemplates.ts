import type { AgentTemplateRow } from "./types";
import { listAgentTemplatesForUser } from "./listAgentTemplatesForUser";
import { getSharedTemplatesForAccount } from "./getSharedTemplatesForAccount";
import selectAgentTemplateFavorites from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";

export async function getAccountTemplates(accountId?: string | null) {
  if (accountId && accountId !== "undefined") {
    // Get owned and public templates
    const ownedAndPublic = await listAgentTemplatesForUser(accountId);

    // Get shared templates using dedicated utility
    const sharedTemplates = await getSharedTemplatesForAccount(accountId);

    // Combine templates and avoid duplicates
    const allTemplates = [...ownedAndPublic];
    const templateIds = new Set(ownedAndPublic.map((t) => t.id));

    sharedTemplates.forEach((template) => {
      if (!templateIds.has(template.id)) {
        allTemplates.push(template);
        templateIds.add(template.id);
      }
    });

    // Get user's favorite templates and convert to Set of IDs
    const favourites = await selectAgentTemplateFavorites({ userId: accountId });
    const favouriteIds = new Set(favourites.map((f) => f.template_id));

    // Mark favorites
    return allTemplates.map((template: AgentTemplateRow) => ({
      ...template,
      is_favourite: favouriteIds.has(template.id),
    }));
  }

  // For anonymous users, return public templates only
  const publicTemplates = await listAgentTemplatesForUser(null);
  return publicTemplates.map((template: AgentTemplateRow) => ({
    ...template,
    is_favourite: false,
  }));
}
