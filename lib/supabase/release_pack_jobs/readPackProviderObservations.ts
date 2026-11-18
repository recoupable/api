import supabase from "../serverClient";
import { z } from "zod";
import type { PackActor } from "@/lib/content/packs/packTypes";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
/** Internal owner-scoped cursor read. Not mounted on a public route. */
export async function readPackProviderObservations(
  actor: PackActor,
  jobId: string,
  after: string | null = null,
  limit = 100,
) {
  if (
    actor.packProtocol !== 2 ||
    !z.uuid().safeParse(jobId).success ||
    (after !== null && !z.uuid().safeParse(after).success) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new PackFenceError("Invalid receipt page");
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    input: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const { data, error } = await Promise.resolve(
    rpc("read_pack_provider_observations", {
      p_actor: actor.accountId,
      p_org: actor.organizationId ?? null,
      p_job: jobId,
      p_after: after,
      p_limit: limit,
    }),
  ).catch(() => {
    throw new PackFenceError("Receipt read unavailable");
  });
  if (error) throw new PackFenceError("Receipt read unavailable");
  return z
    .object({
      operations: z.array(z.record(z.string(), z.unknown())).max(100),
      next_cursor: z.uuid().nullable(),
    })
    .parse(data);
}
