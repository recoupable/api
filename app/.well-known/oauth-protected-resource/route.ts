import { getOAuthResourceMetadata } from "@/lib/oauth/getOAuthResourceMetadata";
export const dynamic = "force-dynamic";
/** RFC 9728 discovery for the canonical MCP endpoint. */
export async function GET() {
  const headers = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
  if (process.env.OAUTH_ENABLED !== "true") return new Response(null, { status: 404, headers });
  try {
    return Response.json(getOAuthResourceMetadata(process.env.OAUTH_ISSUER!), { headers });
  } catch {
    return Response.json({ error: "oauth_unavailable" }, { status: 503, headers });
  }
}
