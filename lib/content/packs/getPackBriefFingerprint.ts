import { createHash } from "node:crypto";
import { releasePackBriefSchema } from "./releasePackSchema";

/** Hash normalized input so an approval cannot silently move to different music or facts. */
export function getPackBriefFingerprint(brief: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(releasePackBriefSchema.parse(brief)))
    .digest("hex");
}
