interface ComposioToolsGetter {
  tools: {
    get: (ownerId: string, opts: { toolkits: string[]; limit: number }) => Promise<unknown>;
  };
}

export interface FetchOwnerToolsInput {
  composio: ComposioToolsGetter;
  /** The Composio account id that owns the connection(s). Undefined skips the fetch. */
  ownerId: string | undefined;
  /** Toolkit slugs to fetch for this owner. Empty skips the fetch. */
  toolkits: string[];
  /** Used in the warning log when Composio rejects — e.g. "artist", "shared". */
  label: string;
  limit: number;
}

/**
 * Fetch explicit Composio tools for a single non-customer owner (artist or
 * shared). Degrades gracefully: if ownerId is missing, toolkits is empty, or
 * Composio rejects, this resolves to an empty tools map so one owner's
 * failure never takes down the rest of the tool router.
 */
export async function fetchOwnerTools({
  composio,
  ownerId,
  toolkits,
  label,
  limit,
}: FetchOwnerToolsInput): Promise<Record<string, unknown>> {
  if (!ownerId || toolkits.length === 0) return {};
  try {
    const result = await composio.tools.get(ownerId, { toolkits, limit });
    return (result ?? {}) as Record<string, unknown>;
  } catch (e) {
    console.warn(`Composio ${label} tools unavailable:`, (e as Error).message);
    return {};
  }
}
