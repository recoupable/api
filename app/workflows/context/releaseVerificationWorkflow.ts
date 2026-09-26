import { runReleaseVerificationStep } from "./runReleaseVerificationStep";

/** Separate durable path for a submitted Spotify album locator. */
export async function releaseVerificationWorkflow(actor: string, owner: string, requestId: string) {
  "use workflow";
  return runReleaseVerificationStep(actor, owner, requestId);
}
