import { z } from "zod";
import { sitePublishEvidenceSchema } from "../sitePublishEvidenceSchema";
import { SiteError } from "../../SiteError";
import type { getSitePublishIdentity } from "../getSitePublishIdentity";
/** Never treat a mismatched create-once receipt as this actor's explicit intent. */
export function validateSiteOverrideReceipt(
  raw: unknown,
  accountId: string,
  identity: ReturnType<typeof getSitePublishIdentity>,
  reason: string,
) {
  const parsed = sitePublishEvidenceSchema.safeParse(raw);
  if (!parsed.success) throw new SiteError(503, "Invalid override receipt");
  const record = parsed.data;
  if (
    record.kind !== "override" ||
    record.reason !== reason ||
    record.recordedByAccountId !== accountId ||
    !z.uuid().safeParse(record.id).success ||
    Date.parse(record.recordedAt) > Date.now() ||
    Object.entries(identity).some(([key, value]) => record[key as keyof typeof identity] !== value)
  )
    throw new SiteError(503, "Override receipt does not match selected intent");
  return record;
}
