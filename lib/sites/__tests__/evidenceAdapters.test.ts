import { beforeEach, describe, expect, it, vi } from "vitest";
import vectors from "./fixtures/site-evidence-digests.json";
import type { Site, SiteSnapshot } from "../schema";
import { serializeSiteEvidence } from "../production/serializeSiteEvidence";
import { getSitePublishContent } from "../production/getSitePublishContent";
import { hashSiteEvidence } from "../production/hashSiteEvidence";
import { captureSavedSiteReview } from "../production/captureSavedSiteReview";
import { assessStoredSitePublishEvidence } from "../production/assessStoredSitePublishEvidence";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import { readPublishableBuild } from "../production/readPublishableBuild";
import { insertSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/insertSitePublishEvidence";
import { selectSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/selectSitePublishEvidence";
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: vi.fn() }));
vi.mock("../authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: vi.fn() }));
vi.mock("../production/readPublishableBuild", () => ({ readPublishableBuild: vi.fn() }));
vi.mock("@/lib/supabase/site_publish_evidence/insertSitePublishEvidence", () => ({
  insertSitePublishEvidence: vi.fn(),
}));
vi.mock("@/lib/supabase/site_publish_evidence/selectSitePublishEvidence", () => ({
  selectSitePublishEvidence: vi.fn(),
}));
const actor = "00000000-0000-4000-8000-000000000001";
const siteId = "00000000-0000-4000-8000-000000000002";
const owner = "00000000-0000-4000-8000-000000000003";
const evidenceId = "00000000-0000-4000-8000-000000000004";
function fixture() {
  const vector = structuredClone(vectors.vectors[0]);
  const candidate = vector.candidate as unknown as SiteSnapshot;
  candidate.production!.reviews = [vector.review as never];
  const site = { id: siteId, owner_id: owner, revision: 8, draft: candidate } as Site;
  const record = {
    id: evidenceId,
    siteId,
    ownerId: owner,
    revision: 8,
    candidateSha256: vector.candidateSha256,
    recordedByAccountId: actor,
    recordedAt: "2026-11-17T00:00:00.000000Z",
    kind: "review",
    review: vector.review,
    reviewSha256: vector.reviewSha256,
  };
  vi.mocked(selectSite).mockResolvedValue(structuredClone(site));
  vi.mocked(authorizeSiteWorkspace).mockResolvedValue(owner);
  vi.mocked(insertSitePublishEvidence).mockResolvedValue(record);
  vi.mocked(selectSitePublishEvidence).mockResolvedValue(record);
  return {
    site,
    record,
    capture: () =>
      captureSavedSiteReview({ accountId: actor, savedSite: site, operationKey: "run:final-save" }),
    assess: (generationToken?: string) =>
      assessStoredSitePublishEvidence(actor, { siteId, revision: 8, evidenceId, generationToken }),
  };
}
beforeEach(() => vi.resetAllMocks());
describe("original canonical byte contract", () => {
  it.each(vectors.vectors)("preserves $name golden bytes and hashes", vector => {
    const content = getSitePublishContent(vector.candidate as unknown as SiteSnapshot);
    expect(serializeSiteEvidence(content)).toBe(vector.candidateCanonical);
    expect(hashSiteEvidence(content)).toBe(vector.candidateSha256);
    expect(serializeSiteEvidence(vector.review)).toBe(vector.reviewCanonical);
    expect(hashSiteEvidence(vector.review)).toBe(vector.reviewSha256);
  });
});
describe("unwired final-save capture", () => {
  it("uses the returned save revision and original report; DB owns ID/time", async () => {
    const f = fixture();
    expect(await f.capture()).toEqual(f.record);
    expect(authorizeSiteWorkspace).toHaveBeenCalledWith(actor, owner);
    expect(insertSitePublishEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: actor,
        ownerId: owner,
        siteId,
        revision: 8,
        operationKey: "run:final-save",
        candidate: f.site.draft,
        review: f.record.review,
      }),
    );
    expect(insertSitePublishEvidence).toHaveBeenCalledTimes(1);
  });
  it.each(["revision", "owner", "site", "candidate"])(
    "rejects changed current %s before persistence",
    async field => {
      const f = fixture();
      const current = structuredClone(f.site);
      if (field === "revision") current.revision++;
      if (field === "owner") current.owner_id = actor;
      if (field === "site") current.id = actor;
      if (field === "candidate") current.draft!.design.experience!.html += "changed";
      vi.mocked(selectSite).mockResolvedValue(current);
      await expect(f.capture()).rejects.toMatchObject({ status: 409 });
      expect(insertSitePublishEvidence).not.toHaveBeenCalled();
    },
  );
  it.each(["sourceSha256", "journeySha256", "runnerSha256"])(
    "never launders stale %s",
    async key => {
      const f = fixture();
      Object.assign(f.site.draft!.production!.reviews[0].verification!.evidence!, {
        [key]: "0".repeat(64),
      });
      vi.mocked(selectSite).mockResolvedValue(structuredClone(f.site));
      await expect(f.capture()).rejects.toMatchObject({ status: 409 });
      expect(insertSitePublishEvidence).not.toHaveBeenCalled();
    },
  );
  it("does not reuse an older report when the final report is missing", async () => {
    const f = fixture();
    f.site.draft!.production!.reviews = [];
    vi.mocked(selectSite).mockResolvedValue(f.site);
    await expect(f.capture()).rejects.toMatchObject({ status: 409 });
  });
  it("rejects a pass without execution metadata", async () => {
    const f = fixture();
    delete f.site.draft!.production!.reviews[0].verification;
    vi.mocked(selectSite).mockResolvedValue(f.site);
    await expect(f.capture()).rejects.toMatchObject({ status: 409 });
  });
  it("retains a failed report without inventing verification", async () => {
    const f = fixture();
    const failed = { verdict: "revise", summary: "Failed", issues: [] };
    f.site.draft!.production!.reviews = [failed as never];
    vi.mocked(selectSite).mockResolvedValue(f.site);
    Object.assign(f.record, { review: failed, reviewSha256: hashSiteEvidence(failed) });
    expect(await f.capture()).toEqual(f.record);
    expect(insertSitePublishEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ review: failed }),
    );
  });
  it.each(["", "contains spaces", "x".repeat(129)])(
    "rejects invalid operation key %s",
    async operationKey => {
      const f = fixture();
      await expect(
        captureSavedSiteReview({ accountId: actor, savedSite: f.site, operationKey }),
      ).rejects.toMatchObject({ status: 400 });
      expect(insertSitePublishEvidence).not.toHaveBeenCalled();
    },
  );
  it("propagates a create-once conflict without retry/new key", async () => {
    const f = fixture();
    const failure = new Error("Conflict");
    vi.mocked(insertSitePublishEvidence).mockRejectedValue(failure);
    await expect(f.capture()).rejects.toBe(failure);
    expect(insertSitePublishEvidence).toHaveBeenCalledTimes(1);
  });
  it.each(["recordedByAccountId", "candidateSha256", "reviewSha256", "revision"])(
    "rejects unexpected returned %s",
    async key => {
      const f = fixture();
      Object.assign(f.record, { [key]: key === "revision" ? 7 : owner });
      await expect(f.capture()).rejects.toMatchObject({ status: 503 });
    },
  );
});
describe("authorized stored assessment", () => {
  it("reads scoped SQL record and uses the actual predicate", async () => {
    const f = fixture();
    expect(await f.assess()).toMatchObject({ status: "satisfied", humanApproval: "not-recorded" });
    expect(selectSitePublishEvidence).toHaveBeenCalledWith({
      accountId: actor,
      ownerId: owner,
      siteId,
      evidenceId,
    });
  });
  it("resolves the signed working build, not a candidate in the record", async () => {
    const f = fixture();
    const candidate = structuredClone(f.site.draft!);
    candidate.design.experience!.javascript = "changed";
    vi.mocked(readPublishableBuild).mockResolvedValue(candidate);
    expect(await f.assess("signed-token")).toMatchObject({
      status: "unsatisfied",
      reason: "candidate-mismatch",
    });
    expect(readPublishableBuild).toHaveBeenCalledWith(
      "signed-token",
      expect.objectContaining({ id: siteId }),
      actor,
    );
  });
  it("rejects a stale revision before the record read", async () => {
    const f = fixture();
    vi.mocked(selectSite).mockResolvedValue({ ...f.site, revision: 9 });
    expect(await f.assess()).toMatchObject({ status: "unsatisfied", reason: "revision-mismatch" });
    expect(selectSitePublishEvidence).not.toHaveBeenCalled();
  });
  it("does not convert access denial into an override", async () => {
    const f = fixture();
    vi.mocked(authorizeSiteWorkspace).mockRejectedValue(new Error("Denied"));
    await expect(f.assess()).rejects.toThrow("Denied");
    expect(selectSitePublishEvidence).not.toHaveBeenCalled();
  });
  it("does not read without authentication", async () => {
    fixture();
    expect(
      await assessStoredSitePublishEvidence("", { siteId, revision: 8, evidenceId }),
    ).toMatchObject({ status: "unsatisfied", reason: "authentication-required" });
    expect(selectSite).not.toHaveBeenCalled();
  });
  it("propagates record unavailability", async () => {
    const f = fixture();
    vi.mocked(selectSitePublishEvidence).mockRejectedValue(new Error("Unavailable"));
    await expect(f.assess()).rejects.toThrow("Unavailable");
  });
});

describe("capture and read boundary failures", () => {
  it("preserves the original create-once receipt on exact repeated capture", async () => {
    const f = fixture();
    expect(await f.capture()).toEqual(await f.capture());
    expect(insertSitePublishEvidence).toHaveBeenNthCalledWith(
      2,
      vi.mocked(insertSitePublishEvidence).mock.calls[0][0],
    );
  });
  it("rejects unauthenticated capture before any read or write", async () => {
    const f = fixture();
    await expect(
      captureSavedSiteReview({ accountId: "", savedSite: f.site, operationKey: "save" }),
    ).rejects.toMatchObject({ status: 401 });
    expect(selectSite).not.toHaveBeenCalled();
    expect(insertSitePublishEvidence).not.toHaveBeenCalled();
  });
  it.each(["capture", "assessment"])("does not invent a missing site during %s", async mode => {
    const f = fixture();
    vi.mocked(selectSite).mockResolvedValue(null);
    await expect(mode === "capture" ? f.capture() : f.assess()).rejects.toMatchObject({
      status: 404,
    });
    expect(insertSitePublishEvidence).not.toHaveBeenCalled();
    expect(selectSitePublishEvidence).not.toHaveBeenCalled();
  });
  it("propagates capture membership revocation before persistence", async () => {
    const f = fixture();
    vi.mocked(authorizeSiteWorkspace).mockRejectedValue(new Error("Revoked"));
    await expect(f.capture()).rejects.toThrow("Revoked");
    expect(insertSitePublishEvidence).not.toHaveBeenCalled();
  });
  it("does not silently fall back from an inaccessible signed generation", async () => {
    const f = fixture();
    vi.mocked(readPublishableBuild).mockRejectedValue(new Error("Expired generation"));
    await expect(f.assess("expired")).rejects.toThrow("Expired generation");
    expect(selectSitePublishEvidence).not.toHaveBeenCalled();
  });
  it.each([null, {}, { kind: "unknown" }])("rejects malformed stored records", async value => {
    const f = fixture();
    vi.mocked(selectSitePublishEvidence).mockResolvedValue(value);
    expect(await f.assess()).toMatchObject({
      status: "unsatisfied",
      reason: "missing-or-invalid-record",
    });
  });
  it.each(["\u00a0", "\u2003", "\ufeff"])(
    "does not accept whitespace-only override intent",
    async reason => {
      const f = fixture();
      vi.mocked(selectSitePublishEvidence).mockResolvedValue({
        ...f.record,
        kind: "override",
        intent: "publish-without-passed-review",
        reason,
      });
      expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
    },
  );
  it("rejects changed candidate bytes under the same revision on read", async () => {
    const f = fixture();
    f.site.draft!.design.experience!.css = "body{color:red}";
    vi.mocked(selectSite).mockResolvedValue(f.site);
    expect(await f.assess()).toMatchObject({ status: "unsatisfied", reason: "candidate-mismatch" });
  });
  it("returns failed report assessment without a write or automatic override", async () => {
    const f = fixture();
    f.record.review.verdict = "revise";
    f.record.reviewSha256 = hashSiteEvidence(f.record.review);
    expect(await f.assess()).toMatchObject({ status: "unsatisfied", reason: "report-not-passed" });
    expect(insertSitePublishEvidence).not.toHaveBeenCalled();
  });
});
