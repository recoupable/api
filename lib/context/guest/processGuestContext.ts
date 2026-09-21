import { createHash } from "node:crypto";
import { z } from "zod";
import { parseContextUrl } from "../parseContextUrl";
import { authorizeContextOwner } from "../authorizeContextOwner";
const inputSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start"), url: z.string().url().max(2048) }),
  z.strictObject({ action: z.literal("read") }),
  z.strictObject({ action: z.literal("claim"), organization_id: z.string().uuid().optional() }),
]);
interface Dependencies {
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  dispatch: (guestId: string) => Promise<unknown>;
  authorize?: typeof authorizeContextOwner;
  dailyLimit: number;
}
/** A private bearer capability controls guest work; authenticated identity controls claim destination. */
export async function processGuestContext(
  token: string,
  input: unknown,
  accountId: string | null,
  deps: Dependencies,
) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid guest session");
  const args = inputSchema.parse(input);
  const hash = createHash("sha256").update(token).digest("hex");
  if (args.action === "read") {
    const result = await deps.rpc("read_context_guest", { p_hash: hash });
    if (!result) throw new Error("Guest session unavailable");
    return result;
  }
  if (args.action === "claim") {
    if (!accountId) throw new Error("Sign in before claiming guest work");
    const { ownerId } = await (deps.authorize ?? authorizeContextOwner)(
      accountId,
      args.organization_id,
    );
    const result = (await deps.rpc("adopt_context_guest", {
      p_hash: hash,
      p_actor: accountId,
      p_owner: ownerId,
    })) as { guestId: string };
    // Dispatching the guest job preserves its lease and skips an already completed job.
    // Do not dispatch the ordinary account job: it would fetch the URL a second time.
    await deps.dispatch(result.guestId);
    return result;
  }
  const resource = parseContextUrl(args.url);
  if (resource.provider !== "spotify") throw new Error("Only Spotify tracks are enabled");
  const normalized = {
    url: resource.url,
    trackId: resource.id,
    topics: ["release_metadata", "artist_metadata"],
  };
  const result = (await deps.rpc("start_context_guest", {
    p_hash: hash,
    p_input: normalized,
    p_fingerprint: createHash("sha256").update(JSON.stringify(normalized)).digest("hex"),
    p_daily_limit: deps.dailyLimit,
  })) as { id: string };
  await deps.dispatch(result.id);
  return result;
}
