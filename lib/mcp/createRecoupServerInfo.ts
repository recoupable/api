import type { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { recoupIcons } from "./recoupIcons";

/** Full MCP identity, including the sidebar icon supported by the underlying SDK. */
export function createRecoupServerInfo(version: string): Implementation {
  return { name: "recoup-mcp", version, icons: recoupIcons };
}
