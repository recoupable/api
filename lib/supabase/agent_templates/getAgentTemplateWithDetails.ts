import supabase from "@/lib/supabase/serverClient";
import { ADMIN_EMAILS } from "@/lib/const";
import type { Tables } from "@/types/database.types";
import type {
  AgentTemplateCreator,
  AgentTemplateWithDetails,
} from "@/lib/supabase/agent_templates/getAccessibleAgentTemplates";
import { selectAgentTemplateFavorites } from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";
import { selectAgentTemplateShares } from "@/lib/supabase/agent_template_shares/selectAgentTemplateShares";

interface CreatorJoin {
  id: string;
  name: string | null;
  account_info: Array<Pick<Tables<"account_info">, "image">> | null;
  account_emails: Array<Pick<Tables<"account_emails">, "email">> | null;
}

type AgentTemplateRowWithCreator = Omit<Tables<"agent_templates">, "creator"> & {
  creator: CreatorJoin | null;
};

/**
 * Fetches a single agent template enriched with the creator block, the
 * caller's `is_favourite` flag, and (for private templates) `shared_emails`.
 *
 * Mirrors the per-row shape returned by `getAccessibleAgentTemplates` so that
 * POST and PATCH responses are byte-compatible with the GET list element.
 *
 * @param templateId - The agent template UUID
 * @param accountId - Caller account UUID, used to compute `is_favourite`
 * @returns The enriched template row, or null if not found / on error.
 */
export async function getAgentTemplateWithDetails(
  templateId: string,
  accountId: string,
): Promise<AgentTemplateWithDetails | null> {
  const { data, error } = await supabase
    .from("agent_templates")
    .select(
      `
      *,
      creator:accounts!agent_templates_creator_fkey (
        id,
        name,
        account_info ( image ),
        account_emails ( email )
      )
    `,
    )
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    console.error("Error selecting agent_template with details:", error);
    return null;
  }

  if (!data) return null;

  const row = data as unknown as AgentTemplateRowWithCreator;

  const favourites = await selectAgentTemplateFavorites(accountId);

  let sharedEmails: string[] = [];
  if (row.is_private) {
    sharedEmails = await getSharedEmailsForTemplate(row.id);
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    prompt: row.prompt,
    tags: row.tags ?? null,
    creator: buildCreator(row.creator),
    is_private: row.is_private,
    is_favourite: favourites.has(row.id),
    favorites_count: row.favorites_count ?? null,
    shared_emails: sharedEmails,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/**
 * Resolves shared recipients for a single template id back to email strings.
 */
async function getSharedEmailsForTemplate(templateId: string): Promise<string[]> {
  const shares = await selectAgentTemplateShares([templateId]);
  if (shares.length === 0) return [];

  const userIds = Array.from(new Set(shares.map(s => s.user_id)));

  const { data, error } = await supabase
    .from("account_emails")
    .select("email")
    .in("account_id", userIds);

  if (error) {
    console.error("Error selecting account_emails for template shares:", error);
    return [];
  }

  return Array.from(
    new Set((data ?? []).map(r => r.email).filter((e): e is string => typeof e === "string")),
  );
}

function buildCreator(row: CreatorJoin | null): AgentTemplateCreator | null {
  if (!row) return null;
  const image = row.account_info?.[0]?.image ?? null;
  const emails = (row.account_emails ?? [])
    .map(e => e.email)
    .filter((e): e is string => typeof e === "string");
  const isAdmin = emails.some(email => ADMIN_EMAILS.includes(email));
  return {
    id: row.id,
    name: row.name ?? null,
    image,
    is_admin: isAdmin,
  };
}
