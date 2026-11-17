import { beforeEach, expect, it, vi } from "vitest";
import { insertSitePublishEvidence } from "../insertSitePublishEvidence";
import { selectSitePublishEvidence } from "../selectSitePublishEvidence";
import vectors from "@/lib/sites/__tests__/fixtures/site-evidence-digests.json";
import type { SiteSnapshot } from "@/lib/sites/schema";
const { rpc, schema } = vi.hoisted(() => {
  const rpc = vi.fn();
  return { rpc, schema: vi.fn(() => ({ rpc })) };
});
vi.mock("@/lib/supabase/serverClient", () => ({ default: { schema } }));
const vector = vectors.vectors[0];
const input = {
  accountId: "actor",
  ownerId: "owner",
  siteId: "site",
  revision: 8,
  operationKey: "run:save",
  candidate: vector.candidate as unknown as SiteSnapshot,
  review: vector.review,
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { id: "db-record" }, error: null });
});
it("passes only the exact proposal capture contract with original canonical bytes", async () => {
  expect(await insertSitePublishEvidence(input)).toEqual({ id: "db-record" });
  expect(schema).toHaveBeenCalledWith("sites_evidence_proposal");
  expect(rpc).toHaveBeenCalledWith("record_evidence", {
    p_actor: "actor",
    p_owner: "owner",
    p_site: "site",
    p_revision: 8,
    p_key: "run:save",
    p_candidate: vector.candidate,
    p_candidate_canonical: vector.candidateCanonical,
    p_candidate_sha: vector.candidateSha256,
    p_decision: { kind: "review", review: vector.review, reviewSha256: vector.reviewSha256 },
    p_review_canonical: vector.reviewCanonical,
  });
});
it("scopes reads by authenticated actor, current owner, site and record", async () => {
  await selectSitePublishEvidence({
    accountId: "actor",
    ownerId: "owner",
    siteId: "site",
    evidenceId: "record",
  });
  expect(rpc).toHaveBeenCalledWith("read_evidence", {
    p_actor: "actor",
    p_owner: "owner",
    p_site: "site",
    p_record: "record",
  });
});
it.each([
  ["40001", 409],
  ["23505", 409],
  ["42501", 403],
  ["PGRST106", 503],
  ["P0001", 503],
])("propagates SQL %s as %s without retry", async (code, status) => {
  rpc.mockResolvedValue({ data: null, error: { code, message: "private SQL details" } });
  await expect(insertSitePublishEvidence(input)).rejects.toMatchObject({ status });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("fails closed on missing data", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(insertSitePublishEvidence(input)).rejects.toMatchObject({ status: 503 });
});
it("propagates transport failure without a second operation", async () => {
  rpc.mockRejectedValue(new Error("transport failed"));
  await expect(insertSitePublishEvidence(input)).rejects.toThrow("transport failed");
  expect(rpc).toHaveBeenCalledTimes(1);
});
