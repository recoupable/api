import { beforeEach, expect, it, vi } from "vitest";
import { insertSiteOverrideEvidence } from "../insertSiteOverrideEvidence";
import { publishSiteEvidenceCandidate } from "../publishSiteEvidenceCandidate";
import vectors from "@/lib/sites/__tests__/fixtures/site-evidence-digests.json";
import type { SiteSnapshot } from "@/lib/sites/schema";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { schema: () => ({ rpc }) } }));
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { id: "receipt" }, error: null });
});
it("captures explicit intent with original candidate bytes and no report", async () => {
  const v = vectors.vectors[0];
  await insertSiteOverrideEvidence({
    accountId: "actor",
    ownerId: "owner",
    siteId: "site",
    revision: 8,
    operationKey: "run:publish",
    candidate: v.candidate as unknown as SiteSnapshot,
    intent: "publish-without-passed-review",
    reason: "Publish now",
  });
  expect(rpc).toHaveBeenCalledWith("record_evidence", {
    p_actor: "actor",
    p_owner: "owner",
    p_site: "site",
    p_revision: 8,
    p_key: "run:publish",
    p_candidate: v.candidate,
    p_candidate_canonical: v.candidateCanonical,
    p_candidate_sha: v.candidateSha256,
    p_decision: {
      kind: "override",
      intent: "publish-without-passed-review",
      reason: "Publish now",
    },
    p_review_canonical: null,
  });
});
it.each([null, "pointer"])(
  "passes nullable pointer explicitly to the fixed publication RPC",
  async expectedPublishedEvidenceId => {
    await publishSiteEvidenceCandidate({
      accountId: "actor",
      ownerId: "owner",
      siteId: "site",
      revision: 8,
      evidenceId: "record",
      candidateSha256: "a".repeat(64),
      expectedPublishedEvidenceId,
    });
    expect(rpc).toHaveBeenCalledWith("publish_candidate", {
      p_actor: "actor",
      p_owner: "owner",
      p_site: "site",
      p_revision: 8,
      p_record: "record",
      p_candidate_sha: "a".repeat(64),
      p_expected_pointer: expectedPublishedEvidenceId,
    });
  },
);
it("propagates publication conflicts without retries", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
  await expect(
    publishSiteEvidenceCandidate({
      accountId: "actor",
      ownerId: "owner",
      siteId: "site",
      revision: 8,
      evidenceId: "record",
      candidateSha256: "a".repeat(64),
      expectedPublishedEvidenceId: null,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(rpc).toHaveBeenCalledOnce();
});
