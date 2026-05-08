import { buildSnapshotStep, type BuildOrgSnapshotInput } from "@/app/workflows/buildSnapshotStep";

/**
 * Vercel Workflow that provisions a per-org base snapshot for warm-boot
 * of future session sandboxes. Kicked fire-and-forget from
 * `createSandboxHandler` when a recoupable org URL is requested but
 * no `created` snapshot exists yet.
 *
 * Single step today (provision + clone + snapshot via `refreshBaseSnapshot`),
 * wrapped here for the durable execution semantics — failures retry up
 * to 3× automatically, the run is observable in the Vercel dashboard,
 * and the request that kicked the workflow is fully decoupled from
 * its lifetime.
 */
export async function buildOrgSnapshotWorkflow(input: BuildOrgSnapshotInput) {
  "use workflow";

  console.log(`[build-org-snapshot] workflow:start name='${input.sandboxName}'`);

  try {
    const snapshotId = await buildSnapshotStep(input);
    console.log(`[build-org-snapshot] Built ${snapshotId} for '${input.sandboxName}'`);
    return { success: true as const, snapshotId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[build-org-snapshot] Failed for '${input.sandboxName}':`, message);
    return { success: false as const, error: message };
  }
}
