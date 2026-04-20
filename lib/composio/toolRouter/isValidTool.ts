import type { Tool } from "ai";

/**
 * Runtime check that an object is a valid Vercel AI SDK Tool.
 *
 * Composio's SDK returns tools shaped as `{ description, inputSchema, execute }`
 * and Vercel AI SDK accepts `inputSchema` as an alias for `parameters`, so
 * we accept either key.
 */
export function isValidTool(tool: unknown): tool is Tool {
  if (typeof tool !== "object" || tool === null) return false;
  const obj = tool as Record<string, unknown>;
  const hasExecute = typeof obj.execute === "function";
  const hasSchema = "parameters" in obj || "inputSchema" in obj;
  return hasExecute && hasSchema;
}
