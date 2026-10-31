import { CallToolRequestSchema, JSONRPCRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { limitedOAuthToolScopes } from "./limitedOAuthToolScopes";

/** Inspect a copy so MCP still owns parsing and handling of the original request body. */
export async function getLimitedOAuthRequestScopes(request: Request): Promise<string[]> {
  if (request.method !== "POST") return [];
  try {
    const rpc = JSONRPCRequestSchema.safeParse(await request.clone().json());
    if (!rpc.success) return [];
    const call = CallToolRequestSchema.safeParse(rpc.data);
    if (!call.success || !Object.hasOwn(limitedOAuthToolScopes, call.data.params.name)) return [];
    return [limitedOAuthToolScopes[call.data.params.name as keyof typeof limitedOAuthToolScopes]];
  } catch {
    // Malformed bodies retain the transport's existing protocol error handling.
    return [];
  }
}
