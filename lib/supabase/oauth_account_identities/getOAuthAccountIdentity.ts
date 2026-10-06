import { z } from "zod";
import supabase from "../serverClient";

type Identity = { appId: string; subject: string; verifiedEmails: string[] };
type IdentityRpc = (
  name: "resolve_oauth_account",
  args: { p_app_id: string; p_subject: string; p_verified_emails: string[] },
) => PromiseLike<{ data: unknown; error: unknown }>;

/** Resolve/bind server-verified identity evidence; never creates a Recoup account. */
export async function getOAuthAccountIdentity(identity: Identity): Promise<string> {
  try {
    // Replace this narrow contract with generated types after the migration is deployed.
    const rpc = supabase.rpc.bind(supabase) as unknown as IdentityRpc;
    const { data, error } = await rpc("resolve_oauth_account", {
      p_app_id: identity.appId,
      p_subject: identity.subject,
      p_verified_emails: identity.verifiedEmails,
    });
    if (error) throw new Error();
    return z.string().uuid().parse(data);
  } catch {
    throw new Error("OAuth requires an available existing account");
  }
}
