import { developmentEntitlementSchema } from "./developmentEntitlementSchema";
import { runDevelopmentEntitlement } from "./runDevelopmentEntitlement";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";

type Authentication =
  | { accountId: string }
  | { denied: "authentication_required" | "delegated_oauth_unavailable" };
/** Shared development transport boundary; no action is added to the public Context schema. */
export async function dispatchDevelopmentEntitlement(
  readInput: () => Promise<unknown>,
  authenticate: () => Promise<Authentication>,
) {
  if (process.env.NODE_ENV !== "development" || process.env.CATALOG_ENTITLEMENT_DEV !== "true")
    return { status: 404, body: { code: "unavailable", error: "Operation unavailable." } };
  const parsed = developmentEntitlementSchema.safeParse(await readInput().catch(() => null));
  if (!parsed.success)
    return {
      status: 400,
      body: { code: "invalid_arguments", error: "Invalid entitlement calculation arguments." },
    };
  let auth: Authentication;
  try {
    auth = await authenticate();
  } catch {
    return {
      status: 401,
      body: { code: "authentication_required", error: "Authentication required." },
    };
  }
  if ("denied" in auth)
    return {
      status: auth.denied === "authentication_required" ? 401 : 403,
      body: {
        code: auth.denied,
        error:
          auth.denied === "authentication_required"
            ? "Authentication required."
            : "Operation unavailable for delegated OAuth.",
      },
    };
  try {
    return {
      status: 200,
      body: await runDevelopmentEntitlement(auth.accountId, parsed.data, { rpc: callContextRpc }),
    };
  } catch {
    return {
      status: 409,
      body: {
        code: "calculation_unavailable",
        error:
          "Calculation unavailable. Check workspace access, current case revision and source evidence.",
      },
    };
  }
}
