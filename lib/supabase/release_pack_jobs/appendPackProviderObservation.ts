import supabase from "../serverClient";
import { z } from "zod";
import type { PackActor } from "@/lib/content/packs/packTypes";
import { PackFenceError } from "@/lib/content/packs/fence/PackFenceError";
const payloadSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("accepted"),
    request_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  }),
  z.strictObject({
    kind: z.literal("completed"),
    request_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    output_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
  z.strictObject({
    kind: z.literal("failed"),
    request_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    reason_code: z.enum(["provider_failed", "response_invalid", "result_unavailable"]),
  }),
]);
/** Separate RPC transaction: append acknowledgement precedes the active phase write. */
export async function appendPackProviderObservation(
  actor: PackActor,
  operationId: string,
  identity: { execution_id?: string; claim_id?: string },
  payload: unknown,
) {
  if (actor.packProtocol !== 2)
    throw new PackFenceError("Receipt port requires explicit protocol 2");
  const parsed = payloadSchema.safeParse(payload);
  const target = z.strictObject({ execution_id: z.uuid(), claim_id: z.uuid() }).safeParse(identity);
  if (!parsed.success || !target.success || !z.uuid().safeParse(operationId).success)
    throw new PackFenceError("Invalid redacted receipt identity");
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    input: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const { data, error } = await Promise.resolve(
    rpc("append_pack_provider_observation", {
      p_actor: actor.accountId,
      p_org: actor.organizationId ?? null,
      p_operation: operationId,
      p_identity: target.data,
      p_payload: parsed.data,
    }),
  ).catch(() => {
    throw new PackFenceError("Receipt persistence uncertain");
  });
  const result = z.object({ state: z.enum(["saved", "reused"]) }).safeParse(data);
  if (error || !result.success)
    throw new PackFenceError("Provider receipt requires reconciliation; no phase was advanced");
  return result.data;
}
