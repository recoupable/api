import { TextContent } from "@modelcontextprotocol/sdk/types.js";

export type CallToolResult = {
  content: TextContent[];
};

/**
 * Creates the base structure for an MCP tool result.
 *
 * @param text - The text content to include in the response
 * @returns An MCP tool response structure
 */
export function getCallToolResult(text: string): CallToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}
