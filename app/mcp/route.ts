import { recoupIcons } from "@/lib/mcp/recoupIcons";
import { registerRecoupExtension } from "@/lib/mcp/extension/registerRecoupExtension";
import { registerFullOAuthTools } from "@/lib/mcp/oauth/registerFullOAuthTools";
import { createFullOAuthToolServices } from "@/lib/mcp/oauth/createFullOAuthToolServices";
import { setOAuthMcpHeaders } from "@/lib/mcp/oauth/setOAuthMcpHeaders";
import { registerAllTools } from "@/lib/mcp/tools";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyBearerToken } from "@/lib/mcp/verifyApiKey";
import { registerOAuthTools } from "@/lib/mcp/oauth/registerOAuthTools";
import { createOAuthToolServices } from "@/lib/mcp/oauth/createOAuthToolServices";
import { verifyOAuthBearer } from "@/lib/oauth/verifyOAuthBearer";

// Site generation can take several minutes, matching the HTTP generation route.
export const maxDuration = 300;

const baseHandler = createMcpHandler(
  server => {
    registerAllTools(server);
    registerRecoupExtension(server);
  },
  {
    serverInfo: {
      name: "recoup-mcp",
      version: "0.0.1",
      icons: recoupIcons,
    },
  },
);

// Wrap with auth - Privy JWT or API key required for all MCP requests
const oauthHandler = createMcpHandler(
  server => {
    registerOAuthTools(server, createOAuthToolServices(), verifyOAuthBearer);
    registerRecoupExtension(server);
  },
  { serverInfo: { name: "recoup-mcp", version: "0.1.0", icons: recoupIcons } },
);

const fullOAuthHandler = createMcpHandler(
  server => {
    registerFullOAuthTools(server, verifyOAuthBearer, createFullOAuthToolServices());
    registerRecoupExtension(server);
  },
  { serverInfo: { name: "recoup-mcp", version: "0.2.0", icons: recoupIcons } },
);

async function handler(req: Request) {
  const bearer = /^Bearer +([^\s]+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  const auth = await verifyBearerToken(req, bearer);
  const response = await withMcpAuth(
    auth?.extra.oauth
      ? auth.scopes.includes("mcp:tools")
        ? fullOAuthHandler
        : oauthHandler
      : baseHandler,
    async () => auth,
    {
      required: true,
      resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
    },
  )(req);
  return setOAuthMcpHeaders(
    response,
    process.env.OAUTH_ENABLED === "true" ? process.env.OAUTH_ISSUER : undefined,
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
