import selectAgentTemplateShares, {
  type AgentTemplateShareWithTemplate,
} from "@/lib/supabase/agent_template_shares/selectAgentTemplateShares";
import type { AgentTemplateRow } from "./types";

export async function getSharedTemplatesForAccount(
  accountId: string,
): Promise<AgentTemplateRow[]> {
  const shares = (await selectAgentTemplateShares({
    userId: accountId,
    includeTemplates: true,
  })) as AgentTemplateShareWithTemplate[];

  const templates: AgentTemplateRow[] = [];
  const processedIds = new Set<string>();

  shares?.forEach((share) => {
    if (!share || !share.templates) return;

    // Handle both single template and array of templates (Supabase can return either)
    const templateList = Array.isArray(share.templates)
      ? share.templates
      : [share.templates];

    templateList?.forEach((template) => {
      if (template && template.id && !processedIds.has(template.id)) {
        templates.push(template as AgentTemplateRow);
        processedIds.add(template.id);
      }
    });
  });

  return templates;
}
