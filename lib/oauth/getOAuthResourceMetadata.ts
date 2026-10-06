import { oauthLaunchScopes } from "./oauthLaunchScopes";
/** Publish a configured canonical resource; never derive issuer identity from request headers. */
export function getOAuthResourceMetadata(issuer: string) {
  const url = new URL(issuer);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/oauth" ||
    url.href !== issuer
  )
    throw new Error("Invalid OAuth issuer");
  return {
    resource: `${url.origin}/mcp`,
    authorization_servers: [issuer],
    scopes_supported: Object.keys(oauthLaunchScopes),
    bearer_methods_supported: ["header"],
    resource_name: "Recoup",
  };
}
