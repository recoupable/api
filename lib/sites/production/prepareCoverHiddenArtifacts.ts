import { createHash } from "node:crypto";
import { coverHiddenReviewRunner } from "./coverHiddenReviewRunner";
import { prepareCoverHiddenReview } from "./prepareCoverHiddenReview";
import type { SiteSnapshot } from "../schema";

/** Supplemental review artifacts are independent of pinned publication journey artifacts. */
export function prepareCoverHiddenArtifacts(snapshot: SiteSnapshot, artworkUrl?: string | null) {
  const input = prepareCoverHiddenReview(snapshot, artworkUrl);
  const coverSource = JSON.stringify(input);
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  return {
    coverSource,
    coverHidden: {
      ...input,
      inputSha256: digest(coverSource),
      runnerSha256: digest(coverHiddenReviewRunner),
    },
    coverRunnerSource: coverHiddenReviewRunner,
  };
}
