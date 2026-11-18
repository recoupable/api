import { createHash } from "node:crypto";
import type { SiteSnapshot } from "../schema";

/** Use existing selected context and supplied assets; never discover or fetch artwork. */
export function prepareCoverHiddenReview(snapshot: SiteSnapshot, artworkUrl?: string | null) {
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const world = snapshot.brandWorld?.specification;
  const permitted =
    artworkUrl && snapshot.assets.some(a => a.type === "image" && a.url === artworkUrl);
  return {
    artworkUrl: permitted && world ? artworkUrl : null,
    status: !artworkUrl
      ? ("missing-input" as const)
      : permitted && world
        ? ("ready" as const)
        : ("unverified" as const),
    reason: !artworkUrl
      ? "Selected context has no release artwork."
      : !world
        ? "Selected visual world is missing."
        : !permitted
          ? "Release artwork is not in this candidate's supplied image assets."
          : "Match only the selected artwork URL in visible inline images.",
    snapshotSha256: hash(snapshot),
    brandWorldSha256: world ? hash(world) : null,
  };
}
