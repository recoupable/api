import { developmentEntitlementHandler } from "@/lib/context/entitlements/developmentEntitlementHandler";
/** Development-only calculation transport; production returns 404 without authentication/storage work. */
export const POST = developmentEntitlementHandler;
