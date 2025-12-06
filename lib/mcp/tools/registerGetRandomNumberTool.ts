import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registers the "get_random_number" tool on the MCP server.
 * Generates a random number between min and max (inclusive).
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetRandomNumberTool(server: McpServer): void {
  server.registerTool(
    "get_random_number",
    {
      inputSchema: {
        min: z.number().int() as z.ZodType<number>,
        max: z.number().int() as z.ZodType<number>,
      },
    },
    async (args: { min: number; max: number }) => {
      const randomNumber = Math.floor(Math.random() * (args.max - args.min + 1)) + args.min;
      return {
        content: [{ type: "text", text: randomNumber.toString() }],
      };
    },
  );
}
