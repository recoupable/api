import {
  songwriterIdentityReceiptSchema,
  type SongwriterIdentityOperation,
  type SongwriterIdentityReceipt,
} from "./songwriterIdentitySchema";

/** Record one operator-confirmed identity resolution after shared actor/workspace authorization.
 * The database rechecks membership, requires the professional to belong to the same workspace,
 * and keeps retries idempotent. No roster enrollment, enrichment or rights follow from it.
 */
export async function processSongwriterIdentityOperation(
  accountId: string,
  ownerId: string,
  args: SongwriterIdentityOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
): Promise<SongwriterIdentityReceipt> {
  const parsed = songwriterIdentityReceiptSchema.safeParse(
    await rpc("resolve_context_songwriter_identity", {
      p_actor: accountId,
      p_owner: ownerId,
      p_request: args.request_id,
      p_professional: args.professional_id,
      p_key: args.idempotency_key,
    }),
  );
  if (!parsed.success) throw new Error("Songwriter identity resolution receipt is invalid");
  const { resolution } = parsed.data;
  if (
    resolution.request_id !== args.request_id ||
    resolution.professional_id !== args.professional_id
  )
    throw new Error(
      "Songwriter identity resolution receipt does not match the confirmed selection",
    );
  return parsed.data;
}
