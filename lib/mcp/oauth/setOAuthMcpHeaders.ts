import { getOAuthResourceMetadata } from "../../oauth/getOAuthResourceMetadata";
/** Browser clients use bearer headers, never credentialed cookies, and discover the canonical issuer. */
export function setOAuthMcpHeaders(response: Response, issuer?: string) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  );
  response.headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, MCP-Session-Id");
  response.headers.set("Cache-Control", "no-store");
  if (response.status === 401 && issuer) {
    const metadata = getOAuthResourceMetadata(issuer);
    response.headers.set(
      "WWW-Authenticate",
      `Bearer resource_metadata="${new URL(metadata.resource).origin}/.well-known/oauth-protected-resource/mcp", scope="${metadata.scopes_supported.join(" ")}"`,
    );
  }
  return response;
}
