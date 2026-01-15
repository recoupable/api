import { registerAllTools } from "@/lib/mcp/tools";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyApiKey } from "@/lib/mcp/verifyApiKey";

const baseHandler = createMcpHandler(
  server => {
    registerAllTools(server);
  },
  {
    serverInfo: {
      name: "recoup-mcp",
      version: "0.0.1",
    },
  },
);

// Wrap with auth - API key is required for all MCP requests
const handler = withMcpAuth(baseHandler, verifyApiKey, {
  required: true,
});

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
