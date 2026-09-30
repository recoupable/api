import { runReleaseVerification } from "@/lib/context/planning/runReleaseVerification";

/** Repeat delivery fails closed against the stable execution and node claims. */
export async function runReleaseVerificationStep(actor: string, owner: string, requestId: string) {
  "use step";
  return runReleaseVerification(actor, owner, requestId);
}
