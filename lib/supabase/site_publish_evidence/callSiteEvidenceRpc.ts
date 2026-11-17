import type { SupabaseClient } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";
import { SiteError } from "@/lib/sites/SiteError";
import type { SiteSnapshot } from "@/lib/sites/schema";
type Scope = { p_actor: string; p_owner: string; p_site: string };
type Functions = {
  record_evidence: {
    Args: Scope & {
      p_revision: number;
      p_key: string;
      p_candidate: SiteSnapshot;
      p_candidate_canonical: string;
      p_candidate_sha: string;
      p_decision:
        | { kind: "review"; review: unknown; reviewSha256: string }
        | { kind: "override"; intent: "publish-without-passed-review"; reason: string };
      p_review_canonical: string | null;
    };
    Returns: unknown;
  };
  publish_candidate: {
    Args: Scope & {
      p_revision: number;
      p_record: string;
      p_candidate_sha: string;
      p_expected_pointer: string | null;
    };
    Returns: unknown;
  };
  read_evidence: { Args: Scope & { p_record: string }; Returns: unknown };
};
type Schema = { Tables: Record<never, never>; Views: Record<never, never>; Functions: Functions };
type ProposedDatabase = { public: Schema; sites_evidence_proposal: Schema };
/** UNWIRED proposal-only RPCs. No schema exposure, grants or fallback are installed here. */
export async function callSiteEvidenceRpc<T extends keyof Functions>(
  name: T,
  args: Functions[T]["Args"],
) {
  const client = supabase as unknown as SupabaseClient<ProposedDatabase>;
  const { data, error } = await client.schema("sites_evidence_proposal").rpc(name, args);
  if (error) {
    const status = ["40001", "23505"].includes(error.code)
      ? 409
      : error.code === "42501"
        ? 403
        : 503;
    throw new SiteError(
      status,
      status === 409
        ? "Site evidence conflict"
        : status === 403
          ? "Site evidence access denied"
          : "Site evidence unavailable",
    );
  }
  if (data == null) throw new SiteError(503, "Site evidence unavailable");
  return data;
}
