import { v5 as uuidv5 } from "uuid";
import { z } from "zod";
import { authorizeContextOwner } from "@/lib/context/authorizeContextOwner";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchPlannedContextModule } from "./dispatchPlannedContextModule";
import { planContextModules } from "./planContextModules";
import { runRecordedContextModules } from "./runRecordedContextModules";

const policyVersion = "spotify-release-verification-v1";
const executionNamespace = "f90fa471-2d49-4b57-972d-5f0ca3b05d34";
const targetSchema = z.strictObject({
  subjectId: z.uuid(),
  kind: z.literal("release"),
  identityConfirmed: z.literal(false),
  availableFields: z.array(z.literal("spotify_id")).length(1),
  reusableModules: z.array(z.string()),
});
type Dependencies = {
  authorize?: (actor: string, owner: string) => Promise<unknown>;
  rpc?: typeof callContextRpc;
  record?: typeof runRecordedContextModules;
  dispatch?: typeof dispatchPlannedContextModule;
  getSpotifyToken?: () => Promise<string>;
};

/** Explicit, server-gated collection of one submitted Spotify album locator. */
export async function runReleaseVerification(
  actor: string,
  owner: string,
  requestId: string,
  deps: Dependencies = {},
) {
  z.uuid().parse(actor);
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  const enabled = () => process.env.CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED === "true";
  if (!enabled()) throw new Error("Spotify release verification is not enabled");
  const authorize =
    deps.authorize ??
    (async (account: string, selectedOwner: string) => {
      const access = await authorizeContextOwner(
        account,
        selectedOwner === account ? undefined : selectedOwner,
      );
      if (access.ownerId !== selectedOwner) throw new Error("Access denied to context owner");
    });
  const rpc = deps.rpc ?? callContextRpc;
  await authorize(actor, owner);
  const readTarget = () =>
    rpc("list_context_release_request_target", { p_owner: owner, p_request: requestId }).then(
      value => targetSchema.parse(value),
    );
  const target = await readTarget();
  const plan = planContextModules({
    entry: "release",
    targets: [{ ...target, reusableModules: [] }],
    requested: [{ subjectId: target.subjectId, module: "spotify_release" }],
    permittedModules: ["spotify_release"],
  });
  if (plan.length !== 1 || plan[0].state !== "ready_for_dispatch")
    throw new Error("Release verification is not ready");
  const executionId = uuidv5(`${requestId}:${policyVersion}`, executionNamespace);
  const getSpotifyToken =
    deps.getSpotifyToken ??
    (async () => {
      const { default: generateAccessToken } = await import("@/lib/spotify/generateAccessToken");
      const token = await generateAccessToken();
      if (!token.access_token) throw new Error("Spotify authentication unavailable");
      return token.access_token;
    });
  const outcomes = await (deps.record ?? runRecordedContextModules)(
    { actor, owner, requestId, executionId, policyVersion, plan },
    {
      authorizeExecution: async () => {
        if (!enabled()) throw new Error("Spotify release verification is not enabled");
        await authorize(actor, owner);
        const current = await readTarget();
        if (current.subjectId !== target.subjectId) throw new Error("Release target changed");
      },
      authorizeNode: async node => {
        if (!enabled() || node.key !== `${target.subjectId}:spotify_release`)
          throw new Error("Release verification node is not permitted");
        await authorize(actor, owner);
        const current = await readTarget();
        if (current.subjectId !== target.subjectId) throw new Error("Release target changed");
      },
      dispatch: async node =>
        (deps.dispatch ?? dispatchPlannedContextModule)(actor, owner, requestId, node, {
          authorize,
          authorizeProvider: async () => {
            if (!enabled()) throw new Error("Spotify release verification is not enabled");
            await authorize(actor, owner);
            const current = await readTarget();
            if (current.subjectId !== target.subjectId) throw new Error("Release target changed");
          },
          collectionVersion: policyVersion,
          rpc,
          acquireMusicBrainzPermit: async () => {
            throw new Error("MusicBrainz is outside release verification");
          },
          getSpotifyToken,
        }),
    },
  );
  return { executionId, policyVersion, outcomes };
}
