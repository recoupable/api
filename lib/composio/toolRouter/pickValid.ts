import type { ToolSet } from "ai";
import { isValidTool } from "./isValidTool";

/**
 * Filter a raw tools record down to the entries whose name passes `filter`
 * AND whose value is a valid Vercel AI SDK tool.
 */
export function pickValid(
  tools: Record<string, unknown>,
  filter: (toolName: string) => boolean,
): ToolSet {
  const out: ToolSet = {};
  for (const [name, tool] of Object.entries(tools)) {
    if (!filter(name)) continue;
    if (isValidTool(tool)) out[name] = tool;
  }
  return out;
}
