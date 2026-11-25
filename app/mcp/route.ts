import { createRecoupServerInfo } from "@/lib/mcp/createRecoupServerInfo";
import { registerRecoupExtension } from "@/lib/mcp/extension/registerRecoupExtension";
import { registerFullOAuthTools } from "@/lib/mcp/oauth/registerFullOAuthTools";
import { createFullOAuthToolServices } from "@/lib/mcp/oauth/createFullOAuthToolServices";
import { getLimitedOAuthRequestScopes } from "@/lib/mcp/oauth/getLimitedOAuthRequestScopes";
import { setOAuthMcpHeaders } from "@/lib/mcp/oauth/setOAuthMcpHeaders";
import { registerAllTools } from "@/lib/mcp/tools";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createModernRecoupHandler } from "@/lib/mcp/skills/createModernRecoupHandler";
import { registerRecoupSkillsTool } from "@/lib/mcp/skills/registerRecoupSkillsTool";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyBearerToken } from "@/lib/mcp/verifyApiKey";
import { registerOAuthTools } from "@/lib/mcp/oauth/registerOAuthTools";
import { createOAuthToolServices } from "@/lib/mcp/oauth/createOAuthToolServices";
import { validateMcpJsonBody } from "@/lib/mcp/validateMcpJsonBody";
import { verifyOAuthBearer } from "@/lib/oauth/verifyOAuthBearer";

// Site generation and analyze_music's full_report (13 sections run one after
// another in one model batch) can take several minutes, matching their HTTP routes.
export const maxDuration = 800;

function createRecoupHandlers(
  register: (server: McpServer) => void,
  version: string,
  withSkills = true,
) {
  const registerConnection = (server: McpServer) => {
    register(server);
    if (withSkills) registerRecoupSkillsTool(server);
  };
  return {
    legacy: createMcpHandler(registerConnection, { serverInfo: createRecoupServerInfo(version) }),
    modern: createModernRecoupHandler(registerConnection, version, withSkills),
  };
}

const baseHandler = createRecoupHandlers(server => {
  registerAllTools(server);
  registerRecoupExtension(server);
}, "0.0.1");

const oauthHandler = createRecoupHandlers(server => {
  registerOAuthTools(server, createOAuthToolServices(), verifyOAuthBearer);
  registerRecoupExtension(server);
}, "0.1.0");

const fullOAuthHandler = createRecoupHandlers(server => {
  registerFullOAuthTools(server, verifyOAuthBearer, createFullOAuthToolServices());
  registerRecoupExtension(server);
}, "0.2.0");

const selectedContextHandler = createRecoupHandlers(
  server =>
    registerFullOAuthTools(
      server,
      verifyOAuthBearer,
      createFullOAuthToolServices(),
      "selected_context",
    ),
  "0.3.0",
  false,
);

async function handler(req: Request) {
  const bearer = /^Bearer +([^\s]+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  const auth = await verifyBearerToken(req, bearer);
  const modern =
    req.headers.has("Mcp-Method") ||
    (req.headers.get("MCP-Protocol-Version") ?? "") >= "2026-07-28";
  const parsed = auth ? await validateMcpJsonBody(req) : { body: undefined };
  if (parsed instanceof Response && !modern) return setOAuthMcpHeaders(parsed);
  const requiredScopes =
    auth?.extra.oauth && !auth.scopes.includes("mcp:tools") && !(parsed instanceof Response)
      ? getLimitedOAuthRequestScopes(parsed.body)
      : [];
  const handlers = auth?.extra.oauth
    ? auth.scopes.includes("mcp:tools")
      ? auth.extra.oauth.selectedContext
        ? selectedContextHandler
        : fullOAuthHandler
      : oauthHandler
    : baseHandler;
  const response = await withMcpAuth(
    modern ? request => handlers.modern.fetch(request, { authInfo: auth }) : handlers.legacy,
    async () => auth,
    {
      required: true,
      requiredScopes,
      resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
    },
  )(req);
  return setOAuthMcpHeaders(
    response,
    process.env.OAUTH_ENABLED === "true" ? process.env.OAUTH_ISSUER : undefined,
    requiredScopes,
  );
}

/**
 * GET handler for the MCP API.
 *
 * @param req - The request object.
 * @returns The response from the MCP handler.
 */
export async function GET(req: Request) {
  return handler(req);
}

/**
 * POST handler for the MCP API.
 *
 * @param req - The request object.
 * @returns The response from the MCP handler.
 */
export async function POST(req: Request) {
  return handler(req);
}

/** Permit cross-origin MCP clients to send bearer credentials. */
export async function OPTIONS() {
  return setOAuthMcpHeaders(new Response(null, { status: 204 }));
}
