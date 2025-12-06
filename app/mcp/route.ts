import { createPaidMcpHandler } from "x402-mcp";
import { facilitator } from "@coinbase/x402";
import { SMART_ACCOUNT_ADDRESS } from "@/lib/const";
import { registerAllTools } from "@/lib/mcp/tools";

let handler: ReturnType<typeof createPaidMcpHandler> | null = null;

/**
 * Gets the MCP handler for the API.
 *
 * @returns The MCP handler.
 */
async function getHandler(): Promise<ReturnType<typeof createPaidMcpHandler>> {
  if (!handler) {
    handler = createPaidMcpHandler(
      server => {
        registerAllTools(server);
      },
      {
        serverInfo: {
          name: "recoup-mcp",
          version: "0.0.1",
        },
      },
      {
        recipient: SMART_ACCOUNT_ADDRESS,
        facilitator,
        network: "base",
      },
    );
  }
  return handler;
}

/**
 * GET handler for the MCP API.
 *
 * @param req - The request object.
 * @returns The response from the MCP handler.
 */
export async function GET(req: Request) {
  const handler = await getHandler();
  return handler(req);
}

/**
 * POST handler for the MCP API.
 *
 * @param req - The request object.
 * @returns The response from the MCP handler.
 */
export async function POST(req: Request) {
  const handler = await getHandler();
  return handler(req);
}
