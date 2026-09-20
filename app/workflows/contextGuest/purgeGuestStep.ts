import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
export async function purgeGuestStep() {
  "use step";
  return callContextRpc("purge_expired_context_guests", {});
}
