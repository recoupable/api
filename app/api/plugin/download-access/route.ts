import { verifyPluginPurchase } from "@/lib/stripe/checkout/verifyPluginPurchase";

/**
 * Returns no customer data. Called by marketing before serving the ZIP.
 *
 * @param request - JSON request containing a private checkout session ID.
 * @returns Download permission without account or payment details.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const allowed = await verifyPluginPurchase(await request.json());
    return Response.json({ allowed }, { status: allowed ? 200 : 403, headers });
  } catch {
    return Response.json({ allowed: false }, { status: 503, headers });
  }
}
