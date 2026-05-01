import { buildAuthConfigs } from "../connectors/buildAuthConfigs";

/**
 * Return a Composio authConfigs map scoped to the given enabled toolkit slugs.
 *
 * Composio rejects `composio.create()` when authConfigs include toolkit slugs
 * not in the session's enabled list (ToolRouterV2_InvalidAuthConfigIds), so
 * every call site passing a subset of toolkits must scope the auth configs
 * accordingly.
 *
 * Returns `undefined` when there is nothing to pass, so callers can safely
 * spread it into request options with `...(cfg && { authConfigs: cfg })`.
 */
export function scopedAuthConfigs(toolkits: string[]): Record<string, string> | undefined {
  const all = buildAuthConfigs();
  if (!all) return undefined;
  const enabled = new Set(toolkits);
  const scoped = Object.fromEntries(Object.entries(all).filter(([slug]) => enabled.has(slug)));
  return Object.keys(scoped).length > 0 ? scoped : undefined;
}
