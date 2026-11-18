import { parseSelectedContext } from "./parseSelectedContext";

/** Resolve only an explicit workspace choice against the same authority used by Context. */
export async function resolveSelectedContext(accountId: string, scopes: string[], input: unknown) {
  const selected = parseSelectedContext(accountId, scopes, input);
  const { authorizeContextOwner } = await import("@/lib/context/authorizeContextOwner");
  const owner = await authorizeContextOwner(accountId, selected.organizationId ?? undefined);
  if (
    owner.ownerId.toLowerCase() !== selected.ownerId ||
    (owner.organizationId?.toLowerCase() ?? null) !== selected.organizationId
  )
    throw new Error("Workspace authority changed");
  return selected;
}
