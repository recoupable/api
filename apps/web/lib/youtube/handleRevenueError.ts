import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { CallToolResult } from "@/lib/mcp/getCallToolResult";

/**
 * Helper function to handle revenue errors
 *
 * @param error - The error to handle
 * @returns { CallToolResult } - The error message
 */
export function handleRevenueError(error: unknown): CallToolResult {
  if (error && typeof error === "object" && "code" in error && error.code === 403) {
    return getToolResultError(
      "Access denied. Channel may not be monetized or lacks Analytics permissions.",
    );
  }

  if (error instanceof Error && error.message.includes("unauthorized_client")) {
    return getToolResultError("Unauthorized client. Please re-authenticate your YouTube account.");
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : "Failed to get YouTube revenue data. Please check your authentication and try again, or channel might not be monetized or have insufficient permissions.";

  return getToolResultError(errorMessage);
}
