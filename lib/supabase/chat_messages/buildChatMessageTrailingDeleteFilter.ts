/**
 * Builds a PostgREST `.or()` filter for deleting trailing chat messages using the
 * same stable ordering as `selectChatMessages` (`created_at` asc, then `id` asc).
 *
 * @param boundary - The inclusive deletion boundary message coordinates.
 * @returns PostgREST filter string for rows at or after the boundary.
 */
export function buildChatMessageTrailingDeleteFilter(boundary: {
  createdAt: string;
  id: string;
}): string {
  const quotedCreatedAt = `"${boundary.createdAt.replace(/"/g, '\\"')}"`;
  return `created_at.gt.${quotedCreatedAt},and(created_at.eq.${quotedCreatedAt},id.gte.${boundary.id})`;
}
