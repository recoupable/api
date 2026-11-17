import { createHash } from "node:crypto";
import { serializeSiteEvidence } from "./serializeSiteEvidence";
export function hashSiteEvidence(value: unknown): string {
  return createHash("sha256").update(serializeSiteEvidence(value)).digest("hex");
}
