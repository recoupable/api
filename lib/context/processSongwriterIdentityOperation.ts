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
  // Postgres returns canonical lowercase UUIDs, so compare the selection in that form.
  const requestId = args.request_id.toLowerCase();
  const professionalId = args.professional_id.toLowerCase();
  const parsed = songwriterIdentityReceiptSchema.safeParse(
    await rpc("resolve_context_songwriter_identity", {
      p_actor: accountId,
      p_owner: ownerId,
      p_request: requestId,
      p_professional: professionalId,
      p_key: args.idempotency_key,
    }),
  );
  if (!parsed.success) throw new Error("Songwriter identity resolution receipt is invalid");
  const { resolution } = parsed.data;
  if (
    resolution.request_id.toLowerCase() !== requestId ||
    resolution.professional_id.toLowerCase() !== professionalId
  )
    throw new Error(
      "Songwriter identity resolution receipt does not match the confirmed selection",
    );
  return parsed.data;
}
