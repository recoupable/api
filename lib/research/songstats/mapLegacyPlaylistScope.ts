/**
 * Maps legacy `current` / `past` playlist status to SongStats `scope`.
 */
export function mapLegacyPlaylistScope(status: "current" | "past"): "current" | "total" {
  return status === "past" ? "total" : "current";
}
