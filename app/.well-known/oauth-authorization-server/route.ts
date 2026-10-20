import { getOAuthResourceMetadata } from "@/lib/oauth/getOAuthResourceMetadata";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

/** Help origin-level discovery reach the RFC 8414 document for our path-based issuer. */
export async function GET() {
  if (process.env.OAUTH_ENABLED !== "true") return new Response(null, { status: 404, headers });
  try {
    const metadata = getOAuthResourceMetadata(process.env.OAUTH_ISSUER!);
    const issuer = new URL(metadata.authorization_servers[0]);
    const location = new URL(`/.well-known/oauth-authorization-server${issuer.pathname}`, issuer)
      .href;
    return new Response(null, { status: 308, headers: { ...headers, Location: location } });
  } catch {
    return Response.json({ error: "oauth_unavailable" }, { status: 503, headers });
  }
}

/** Permit public discovery clients to inspect the alias without signing in. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers });
}
