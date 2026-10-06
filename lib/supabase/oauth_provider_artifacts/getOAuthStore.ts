import supabase from "../serverClient";
import { createOAuthStore, type OAuthRpc } from "./createOAuthStore";

/** Server-only RPC bridge. Requires the OAuth storage migration before runtime use. */
export function getOAuthStore() {
  // The narrow RPC contract is validated at runtime until the migration is deployed
  // and Supabase's generated Database types include its new functions.
  return createOAuthStore(supabase.rpc.bind(supabase) as unknown as OAuthRpc);
}
