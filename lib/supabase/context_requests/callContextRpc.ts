import supabase from "../serverClient";
import type { Json } from "@/types/database.types";

/** Server-only context transactions; generated database types follow the migration release. */
export async function callContextRpc(
  name: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const allowed = [
    "start_context_guest",
    "read_context_guest",
    "claim_context_guest_worker",
    "complete_context_guest",
    "fail_context_guest",
    "adopt_context_guest",
    "context_guest_worker_scope",
    "purge_expired_context_guests",
    "create_context_request",
    "create_catalog_context_request",
    "read_context_request",
    "list_context_request_targets",
    "resolve_context_songstats_lookup",
    "list_context_catalog_members",
    "expand_context_catalog_members",
    "list_context_request_executions",
    "read_context_execution",
    "create_context_execution",
    "claim_context_execution_node",
    "save_context_execution_outcome",
    "claim_context_request",
    "commit_spotify_context",
    "fail_context_request",
    "read_context_documents",
    "resolve_context_spotify_release",
  ];
  if (!allowed.includes(name)) throw new Error("Unknown context operation");
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: Json | null; error: { message: string } | null }>;
  const { data, error } = await rpc(name, params);
  if (error) throw new Error(`Context storage operation failed: ${error.message}`);
  return data;
}
