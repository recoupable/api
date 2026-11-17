import { z } from "zod";
import { sitePublishEvidenceSchema } from "../sitePublishEvidenceSchema";
import { getSitePublishIdentity } from "../getSitePublishIdentity";
import { serializeSiteEvidence } from "../serializeSiteEvidence";
import { SiteError } from "../../SiteError";
import type { SiteSnapshot } from "../../schema";
import type { SitePublicationSelection } from "./selectedSitePublicationSchema";
const receiptSchema = z.object({
  site: z
    .object({
      id: z.uuid(),
      owner_id: z.uuid(),
      artist_id: z.uuid(),
      revision: z.number().int().nonnegative(),
      published_evidence_id: z.uuid(),
      published_at: z.iso.datetime({ offset: true }),
      published: z
        .object({
          design: z.object({
            experience: z.object({
              html: z.string().min(1),
              css: z.string(),
              javascript: z.string(),
            }),
          }),
        })
        .passthrough(),
    })
    .passthrough(),
  evidence: sitePublishEvidenceSchema,
  humanApproval: z.literal("not-recorded"),
});
/** Failure here may follow a committed write. Propagate; never automatically retry/rekey. */
export function validateSitePublicationReceipt(
  raw: unknown,
  selection: SitePublicationSelection,
  record: z.infer<typeof sitePublishEvidenceSchema>,
) {
  const parsed = receiptSchema.safeParse(raw);
  if (!parsed.success) throw new SiteError(503, "Invalid publication receipt");
  const { site, evidence } = parsed.data;
  // Inspect original JSON, not a Zod-stripped nested design, when checking exact content.
  const published = (raw as { site: { published: SiteSnapshot } }).site.published;
  const identity = getSitePublishIdentity({
    siteId: site.id,
    ownerId: site.owner_id,
    revision: site.revision,
    candidate: published,
  });
  if (
    site.id !== selection.siteId ||
    site.owner_id !== selection.ownerId ||
    site.artist_id !== selection.artistId ||
    site.revision !== selection.revision ||
    site.published_evidence_id !== record.id ||
    identity.candidateSha256 !== selection.candidateSha256 ||
    serializeSiteEvidence(evidence) !== serializeSiteEvidence(record)
  )
    throw new SiteError(503, "Publication receipt does not match selection");
  return { ...parsed.data, site: { ...site, published } };
}
