import { randomUUID } from "node:crypto";
import type { SpotifyContext } from "../fetchSpotifyContext";
interface Dependencies {
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  extract: (id: string) => Promise<SpotifyContext>;
  authorize: (actor: string, owner: string) => Promise<unknown>;
}
/** Guest jobs keep their identity while signup attaches their eventual output. */
export async function runGuestContext(id: string, deps: Dependencies) {
  const token = randomUUID();
  const work = (await deps.rpc("claim_context_guest_worker", { p_id: id, p_token: token })) as {
    input: { trackId: string };
  } | null;
  if (!work) return { skipped: true };
  try {
    const payload = await deps.extract(work.input.trackId);
    const scope = (await deps.rpc("context_guest_worker_scope", { p_id: id, p_token: token })) as {
      actor: string | null;
      owner: string | null;
    };
    if (!scope) throw new Error("Guest worker no longer active");
    if (scope.actor && scope.owner) await deps.authorize(scope.actor, scope.owner);
    return await deps.rpc("complete_context_guest", {
      p_id: id,
      p_token: token,
      p_payload: payload,
    });
  } catch (error) {
    await deps.rpc("fail_context_guest", { p_id: id, p_token: token });
    throw error;
  }
}
