import type { ContextOperationError } from "@/lib/context/ContextOperationError";
import { getCallToolResult, type CallToolResult } from "@/lib/mcp/getCallToolResult";

/**
 * Same code, message, retryable flag and guidance as the HTTP error body, in the MCP result
 * shape, flagged as a tool execution error.
 */
export function getContextToolResultError(
  error: ContextOperationError,
): CallToolResult & { isError: true } {
  return {
    ...getCallToolResult(
      JSON.stringify({
        success: false,
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        guidance: error.guidance,
      }),
    ),
    isError: true,
  };
}
