import { CallToolResult, getCallToolResult } from "./getCallToolResult";

/**
 * Creates a standardized success response for MCP tools.
 *
 * @param data - The data to return
 * @returns An MCP tool response with success content
 */
export function getToolResultSuccess(data: unknown): CallToolResult {
  return getCallToolResult(JSON.stringify(data));
}
