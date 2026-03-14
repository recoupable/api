import { CallToolResult, getCallToolResult } from "./getCallToolResult";

/**
 * Creates a standardized error response for MCP tools.
 *
 * @param message - The error message to return
 * @returns An MCP tool response with error content
 */
export function getToolResultError(message: string): CallToolResult {
  return getCallToolResult(
    JSON.stringify({
      success: false,
      message,
    }),
  );
}
