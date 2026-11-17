import { expect, it } from "vitest";
import { selectedSitePublicationSchema } from "../production/publication/selectedSitePublicationSchema";
it("normalizes valid mixed-case UUID selection and evidence references", () => {
  const uuid = "ABCDEFAB-1234-4ABC-8DEF-123456789ABC";
  const parsed = selectedSitePublicationSchema.parse({
    selection: {
      siteId: uuid,
      ownerId: uuid,
      artistId: uuid,
      revision: 1,
      candidateSha256: "a".repeat(64),
      expectedPublishedEvidenceId: uuid,
    },
    evidence: { kind: "review", evidenceId: uuid },
  });
  expect(parsed.selection.siteId).toBe(uuid.toLowerCase());
  expect(parsed.selection.ownerId).toBe(uuid.toLowerCase());
  expect(parsed.selection.artistId).toBe(uuid.toLowerCase());
  expect(parsed.selection.expectedPublishedEvidenceId).toBe(uuid.toLowerCase());
  expect(parsed.evidence).toEqual({ kind: "review", evidenceId: uuid.toLowerCase() });
});
