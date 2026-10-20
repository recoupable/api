import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import type { PackActor } from "@/lib/content/packs/packTypes";
export async function settlePackStep(actor: PackActor, jobId: string, error?: string) {
  "use step";
  return runPackCommand(actor, "settle", jobId, { error: error ?? null });
}
