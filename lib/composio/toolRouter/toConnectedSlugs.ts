import type { ConnectorInfo } from "../connectors/getConnectors";

/**
 * Reduce a list of Composio connectors to a set of toolkit slugs that are
 * currently active (isConnected=true). Used by the tool router to decide
 * which toolkits each owner (customer / artist / shared) should expose.
 */
export function toConnectedSlugs(connectors: ConnectorInfo[]): Set<string> {
  return new Set(connectors.filter(c => c.isConnected).map(c => c.slug));
}
