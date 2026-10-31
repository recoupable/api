import supabase from "../serverClient";
import type { PackActor, PackSnapshot } from "@/lib/content/packs/packTypes";
/** Narrow service-only RPC adapter until generated database types follow migration release. */
export async function runPackCommand(
  actor: PackActor,
  action: string,
  jobId: string,
  input: Record<string, unknown> = {},
): Promise<PackSnapshot> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
  const { data, error } = await rpc("release_pack_command", {
    p_actor: actor.accountId,
    p_org: actor.organizationId ?? null,
    p_action: action,
    p_job: jobId,
    p_input: input,
  });
  if (error)
    throw new Error(
      error.code === "P0002"
        ? /Insufficient credits/i.test(error.message)
          ? "Insufficient credits"
          : "Pack not found"
        : error.message,
    );
  if (!data || typeof data !== "object" || !("job" in data))
    throw new Error("Invalid pack storage response");
  if ("command_expired" in data && data.command_expired)
    throw new Error("Pack production window expired; inspect saved status before retrying");
  return data as PackSnapshot;
}
