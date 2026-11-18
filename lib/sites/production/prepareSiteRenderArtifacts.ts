import { coverHiddenReviewRunner } from "./coverHiddenReviewRunner";
import { prepareCoverHiddenReview } from "./prepareCoverHiddenReview";
import { createHash } from "node:crypto";
import { journeyRunner } from "./journeyRunner";
import type { ExperienceContract } from "./experienceContract";
import type { SiteSnapshot } from "../schema";

/** Exact bytes used by the review VM; pure preparation, no rendering or provider calls. */
export function prepareSiteRenderArtifacts(
  snapshot: SiteSnapshot,
  contract?: ExperienceContract,
  artworkUrl?: string | null,
) {
  const mediaOrigins =
    [
      ...new Set(
        snapshot.assets
          .filter(a => a.type === "video" || a.type === "audio")
          .map(a => new URL(a.url).origin),
      ),
    ].join(" ") || "'none'";
  const experience = snapshot.design.experience!;
  const source = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; font-src data:; connect-src 'none'; media-src ${mediaOrigins}; form-action 'none'; frame-src 'none'; base-uri 'none'"><style>${experience.css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${experience.html}<script>window.__recoupEvents=[];window.recoup={track:event=>window.__recoupEvents.push(event),join:()=>window.__recoupEvents.push("join")};</script><script>${experience.javascript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
  const journeySource = JSON.stringify(contract ?? null);
  const coverHidden = prepareCoverHiddenReview(snapshot, artworkUrl);
  const coverSource = JSON.stringify(coverHidden);
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  const evidence = {
    sourceSha256: digest(source),
    journeySha256: digest(journeySource),
    runnerSha256: digest(journeyRunner),
  };
  return {
    source,
    journeySource,
    coverSource,
    coverHidden: {
      ...coverHidden,
      inputSha256: digest(coverSource),
      runnerSha256: digest(coverHiddenReviewRunner),
    },
    coverRunnerSource: coverHiddenReviewRunner,
    runnerSource: journeyRunner,
    evidence,
  };
}
