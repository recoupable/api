import { fanConnectionDatabase } from "./fanConnectionDatabase";
/** Maintenance failures must not reject a fan's new authorization attempt. */
export async function cleanupFanSessions() {
  try {
    const { error } = await fanConnectionDatabase().rpc("cleanup_site_transient_data");
    if (error) console.error("[sites] Transient session cleanup failed");
  } catch {
    console.error("[sites] Transient session cleanup unavailable");
  }
}
