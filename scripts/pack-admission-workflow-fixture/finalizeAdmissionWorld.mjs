import { drainAdmissionTrace } from "./drainAdmissionTrace.mjs";
import { assertRecoveryTrace } from "./assertRecoveryTrace.mjs";
/** Close first, drain late observations, then qualify one fresh snapshot. Preserve primary failure. */
export async function finalizeAdmissionWorld(ctx, runId, originalError) {
  let cleanupError;
  try {
    await ctx.world.close();
  } catch (error) {
    cleanupError = error;
  }
  let trace;
  try {
    trace = await drainAdmissionTrace(ctx.observer);
  } catch (error) {
    cleanupError ??= error;
  }
  if (originalError) {
    if (cleanupError) console.error("PACK_ADMISSION_CLEANUP_FAILURE", cleanupError.message);
    throw originalError;
  }
  if (cleanupError) throw cleanupError;
  assertRecoveryTrace(trace, runId);
  return trace;
}
