/**
 * Input for resolveSessionToolkits.
 */
export interface ResolveSessionToolkitsInput {
  /** Every toolkit the platform supports in Tool Router sessions. */
  enabledToolkits: string[];
  /** Toolkit slugs the caller has actively connected under their own account. */
  customerConnectedSlugs: Set<string>;
  /** Toolkit slugs the artist in context has actively connected. */
  artistConnectedSlugs: Set<string>;
  /** Toolkit slugs the shared Recoupable account has connected (Google-only). */
  sharedConnectedSlugs: Set<string>;
}

/**
 * Toolkits each Composio session should expose, per owner.
 */
export interface ResolvedSessionToolkits {
  customer: string[];
  artist: string[];
  shared: string[];
}

/**
 * Decide which toolkits each Composio session should expose.
 *
 * Priority: artist > customer > shared. A toolkit only appears in one
 * session to avoid duplicate tools across the merged ToolSet.
 *
 * - Customer session gets every enabled toolkit so its meta-tools can
 *   dynamically discover whatever the caller has connected themselves —
 *   but only meta-tools survive the merge in `getComposioTools`, so
 *   customer's own toolkit tools are not directly exposed here.
 * - Artist session exposes every toolkit the artist has connected. When
 *   the same toolkit is connected on both customer and artist accounts,
 *   the artist wins because the chat agent is acting on behalf of the
 *   artist; routing to customer would silently drop the tools (the
 *   merge filters customer to meta-only).
 * - Shared session exposes only toolkits neither the artist nor the
 *   customer covers.
 */
export function resolveSessionToolkits({
  enabledToolkits,
  customerConnectedSlugs,
  artistConnectedSlugs,
  sharedConnectedSlugs,
}: ResolveSessionToolkitsInput): ResolvedSessionToolkits {
  const enabledSet = new Set(enabledToolkits);

  const artist = enabledToolkits.filter(slug => artistConnectedSlugs.has(slug));

  const artistSet = new Set(artist);

  const shared = enabledToolkits.filter(
    slug =>
      sharedConnectedSlugs.has(slug) &&
      enabledSet.has(slug) &&
      !customerConnectedSlugs.has(slug) &&
      !artistSet.has(slug),
  );

  return {
    customer: [...enabledToolkits],
    artist,
    shared,
  };
}
