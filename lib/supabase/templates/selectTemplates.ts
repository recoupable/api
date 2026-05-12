import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";
import { RECOUP_ORG_ID } from "@/lib/const";
import type { Tables } from "@/types/database.types";

export interface TemplateCreator {
  id: string;
  name: string | null;
  image: string | null;
  is_admin: boolean;
}

export type Template = Omit<Tables<"agent_templates">, "creator"> & {
  creator: TemplateCreator | null;
  is_favourite: boolean;
  shared_emails: string[];
};

export type SelectTemplatesParams = { id: string } | { accessibleTo: string };

// Sentinel used for the favorite filter when no caller is passed (validators).
// PostgREST filters the embed by user_id; this UUID matches nothing →
// caller_favorite stays empty and `is_favourite` resolves to `false`.
const NO_CALLER = "00000000-0000-0000-0000-000000000000";

// Everything the API response needs, in one shot:
//   creator.org_membership → presence ⇒ is_admin
//   caller_favorite        → presence ⇒ is_favourite (filtered to caller)
//   template_shares.sharee.account_emails → flatten ⇒ shared_emails
const SELECT = `
  *,
  creator:accounts!agent_templates_creator_fkey (
    id,
    name,
    account_info ( image ),
    org_membership:account_organization_ids!account_organization_ids_account_id_fkey ( organization_id )
  ),
  caller_favorite:agent_template_favorites ( user_id ),
  template_shares:agent_template_shares (
    sharee:accounts!agent_template_shares_user_id_fkey (
      account_emails ( email )
    )
  )
` as const;

const _typedQuery = supabase.from("agent_templates").select(SELECT);
type RawTemplate = QueryData<typeof _typedQuery>[number];

/**
 * Reads agent templates shaped for the API.
 *
 * - `{ id }`           → row with that id, or empty array
 * - `{ accessibleTo }` → own + public + shared (deduped, sorted by title)
 *
 * Everything the response needs — `is_admin`, `is_favourite`,
 * `shared_emails` — is embedded in the same query via PostgREST joins.
 * The JS step just unwraps the embedded arrays into booleans and dedupes
 * emails.
 *
 * Throws on database error.
 */
export async function selectTemplates(
  params: SelectTemplatesParams,
  forAccountId?: string,
): Promise<Template[]> {
  const callerId = forAccountId ?? NO_CALLER;

  // 1. Fetch
  let rows: RawTemplate[];
  if ("id" in params) {
    const { data, error } = await supabase
      .from("agent_templates")
      .select(SELECT)
      .eq("id", params.id)
      .eq("creator.org_membership.organization_id", RECOUP_ORG_ID)
      .eq("caller_favorite.user_id", callerId);
    if (error) {
      console.error("Error selecting template by id:", error);
      throw new Error(
        `selectTemplates(id) failed: ${error.message} | code=${error.code} | details=${error.details} | hint=${error.hint}`,
      );
    }
    rows = data ?? [];
  } else {
    const accountId = params.accessibleTo;
    const [owned, shared] = await Promise.all([
      supabase
        .from("agent_templates")
        .select(SELECT)
        .or(`creator.eq.${accountId},is_private.eq.false`)
        .eq("accounts.account_organization_ids.organization_id", RECOUP_ORG_ID)
        .eq("caller_favorite.user_id", callerId)
        .order("title"),
      supabase
        .from("agent_template_shares")
        .select(`template:agent_templates!agent_template_shares_template_id_fkey (${SELECT})`)
        .eq("user_id", accountId)
        .eq("template.creator.org_membership.organization_id", RECOUP_ORG_ID)
        .eq("template.caller_favorite.user_id", callerId),
    ]);
    if (owned.error) {
      console.error("Error selecting owned/public templates:", owned.error);
      throw new Error(
        `selectTemplates(accessibleTo) owned/public failed: ${owned.error.message} | code=${owned.error.code} | details=${owned.error.details} | hint=${owned.error.hint}`,
      );
    }
    if (shared.error) {
      console.error("Error selecting shared templates:", shared.error);
      throw new Error(
        `selectTemplates(accessibleTo) shared failed: ${shared.error.message} | code=${shared.error.code} | details=${shared.error.details} | hint=${shared.error.hint}`,
      );
    }
    const sharedRows = (shared.data ?? []).flatMap(s => {
      const t = (s as { template: RawTemplate | RawTemplate[] | null }).template;
      return t ? (Array.isArray(t) ? t : [t]) : [];
    });
    const seen = new Set<string>();
    rows = [...(owned.data ?? []), ...sharedRows].filter(r =>
      seen.has(r.id) ? false : (seen.add(r.id), true),
    );
  }
  if (rows.length === 0) return [];

  // 2. Shape — unwrap embedded arrays into booleans + emails
  return rows
    .map(row => {
      const creatorRow = Array.isArray(row.creator) ? row.creator[0] : row.creator;
      const creator: TemplateCreator | null = creatorRow
        ? {
            id: creatorRow.id,
            name: creatorRow.name ?? null,
            image: creatorRow.account_info?.[0]?.image ?? null,
            is_admin: (creatorRow.org_membership ?? []).length > 0,
          }
        : null;
      const isOwnedPrivate =
        !!forAccountId && row.is_private && creator?.id === forAccountId;
      const sharedEmails = isOwnedPrivate
        ? Array.from(
            new Set(
              (row.template_shares ?? []).flatMap(s => {
                const sharees = Array.isArray(s.sharee) ? s.sharee : s.sharee ? [s.sharee] : [];
                return sharees.flatMap(sh =>
                  (sh.account_emails ?? [])
                    .map(ae => ae.email)
                    .filter((e): e is string => typeof e === "string"),
                );
              }),
            ),
          )
        : [];
      const { creator: _c, caller_favorite, template_shares: _ts, ...rest } = row;
      return {
        ...rest,
        creator,
        is_favourite: (caller_favorite ?? []).length > 0,
        shared_emails: sharedEmails,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
