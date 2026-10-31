import { CallToolRequestSchema, JSONRPCRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { limitedOAuthToolScopes } from "./limitedOAuthToolScopes";

/** Infer scope only from a validated JSON-RPC tool call, using the route's parsed copy. */
export function getLimitedOAuthRequestScopes(body: unknown): string[] {
  const rpc = JSONRPCRequestSchema.safeParse(body);
  if (!rpc.success) return [];
  const call = CallToolRequestSchema.safeParse(rpc.data);
  if (!call.success || !Object.hasOwn(limitedOAuthToolScopes, call.data.params.name)) return [];
  return [limitedOAuthToolScopes[call.data.params.name as keyof typeof limitedOAuthToolScopes]];
}
