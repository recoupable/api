import { createHash } from "node:crypto";

/** Saved `release_metadata` artwork entry shape (`fetchSpotifyContext` keeps only `url`). */
export interface ReleaseArtworkImage {
  url: string;
  width?: number;
  height?: number;
}
export type ResolvedArtworkBrandingInput =
  | {
      status: "available";
      releaseSubjectId: string;
      artworkUrl: string;
      /** SHA-256 of the exact URL plus known dimensions, so a changed asset is a new version. */
      assetVersion: string;
    }
  | {
      status: "missing";
      gap: {
        topic: "artwork_branding";
        subjectId: string;
        reason: "no_artwork_in_release_metadata" | "unsupported_artwork_url";
        fallback: "release_metadata";
      };
    };
const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};
const area = (image: ReleaseArtworkImage) =>
  Number.isFinite(image.width) && Number.isFinite(image.height)
    ? (image.width as number) * (image.height as number)
    : -1;

/**
 * Pure selection of one release's artwork for extraction. Never throws and never calls a
 * provider: missing or unsupported artwork becomes an explicit gap with the metadata fallback.
 */
export function resolveArtworkBrandingInput(
  releaseSubjectId: string,
  artwork: ReleaseArtworkImage[] | null | undefined,
): ResolvedArtworkBrandingInput {
  const gap = (reason: "no_artwork_in_release_metadata" | "unsupported_artwork_url") =>
    ({
      status: "missing",
      gap: {
        topic: "artwork_branding",
        subjectId: releaseSubjectId,
        reason,
        fallback: "release_metadata",
      },
    }) as const;
  const images = Array.isArray(artwork)
    ? artwork.filter(image => typeof image?.url === "string" && image.url.length > 0)
    : [];
  if (!images.length) return gap("no_artwork_in_release_metadata");
  const secure = images.filter(image => isHttps(image.url));
  if (!secure.length) return gap("unsupported_artwork_url");
  // Spotify lists the largest image first; explicit dimensions win when present.
  const chosen = secure.reduce((best, image) => (area(image) > area(best) ? image : best));
  const assetVersion = createHash("sha256")
    .update(JSON.stringify([chosen.url, chosen.width ?? null, chosen.height ?? null]))
    .digest("hex");
  return { status: "available", releaseSubjectId, artworkUrl: chosen.url, assetVersion };
}
