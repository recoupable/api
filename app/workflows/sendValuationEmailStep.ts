import { sendValuationReportEmail } from "@/lib/emails/valuationReport/sendValuationReportEmail";
import type { Tables } from "@/types/database.types";

/**
 * Best-effort valuation-report email after a snapshot run reaches `done`
 * (recoupable/chat#1867). Runs as its own step so the send is memoized across
 * workflow retries, and never throws: by this point the measurements are
 * written and the run is marked done, so an email failure must not flip a
 * successful run to failed.
 *
 * @param snapshot - The completed snapshot row (loaded by getSnapshotStep)
 */
export async function sendValuationEmailStep(
  snapshot: Tables<"playcount_snapshots">,
): Promise<void> {
  "use step";
  try {
    const result = await sendValuationReportEmail(snapshot);
    console.log(`[playcount-snapshot] Valuation email for ${snapshot.id}:`, result);
  } catch (error) {
    console.error(`[playcount-snapshot] Valuation email failed for ${snapshot.id}:`, error);
  }
}
