import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import type { PackActor } from "@/lib/content/packs/packTypes";
/** Unwired scheduler adapter: an ambiguous settlement requires reconciliation, not retry. */
export async function settleBoundedPackStep(actor: PackActor, jobId: string, error?: string) {
  "use step";
  return runPackCommand(actor, "settle", jobId, { error: error ?? null });
}
settleBoundedPackStep.maxRetries = 0;
