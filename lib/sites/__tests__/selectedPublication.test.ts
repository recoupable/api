import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import vectors from "./fixtures/site-evidence-digests.json";
import { publishSelectedSiteEvidence } from "../production/publication/publishSelectedSiteEvidence";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import { readPublishableBuild } from "../production/readPublishableBuild";
import { authorizeSelectedSitePublication } from "../production/publication/authorizeSelectedSitePublication";
import { selectSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/selectSitePublishEvidence";
import { insertSiteOverrideEvidence } from "@/lib/supabase/site_publish_evidence/insertSiteOverrideEvidence";
import { publishSiteEvidenceCandidate } from "@/lib/supabase/site_publish_evidence/publishSiteEvidenceCandidate";
import { hashSiteEvidence } from "../production/hashSiteEvidence";
import type { Site, SiteSnapshot } from "../schema";
vi.mock("@/lib/supabase/sites/selectSite", () => ({ selectSite: vi.fn() }));
vi.mock("../authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: vi.fn() }));
vi.mock("../production/readPublishableBuild", () => ({ readPublishableBuild: vi.fn() }));
vi.mock("../production/publication/authorizeSelectedSitePublication", () => ({
  authorizeSelectedSitePublication: vi.fn(),
}));
vi.mock("@/lib/supabase/site_publish_evidence/selectSitePublishEvidence", () => ({
  selectSitePublishEvidence: vi.fn(),
}));
vi.mock("@/lib/supabase/site_publish_evidence/insertSiteOverrideEvidence", () => ({
  insertSiteOverrideEvidence: vi.fn(),
}));
vi.mock("@/lib/supabase/site_publish_evidence/publishSiteEvidenceCandidate", () => ({
  publishSiteEvidenceCandidate: vi.fn(),
}));
const actor = "00000000-0000-4000-8000-000000000001";
const siteId = "00000000-0000-4000-8000-000000000002";
const ownerId = "00000000-0000-4000-8000-000000000003";
const evidenceId = "00000000-0000-4000-8000-000000000004";
const artistId = "00000000-0000-4000-8000-000000000005";
function fixture() {
  const v = structuredClone(vectors.vectors[0]);
  const candidate = v.candidate as unknown as SiteSnapshot;
  const site = {
    id: siteId,
    owner_id: ownerId,
    artist_id: artistId,
    revision: 8,
    draft: candidate,
    published_evidence_id: null,
  } as Site & { published_evidence_id: string | null };
  const record = {
    id: evidenceId,
    siteId,
    ownerId,
    revision: 8,
    candidateSha256: v.candidateSha256,
    recordedByAccountId: actor,
    recordedAt: "2026-11-17T00:00:00.000000Z",
    kind: "review",
    review: v.review,
    reviewSha256: v.reviewSha256,
  };
  const selection = {
    siteId,
    ownerId,
    artistId,
    revision: 8,
    candidateSha256: v.candidateSha256,
    expectedPublishedEvidenceId: null as string | null,
  };
  const request = { selection, evidence: { kind: "review", evidenceId } };
  vi.mocked(selectSite).mockResolvedValue(site);
  vi.mocked(selectSitePublishEvidence).mockResolvedValue(record);
  const receipt = {
    site: {
      ...site,
      published: candidate,
      published_evidence_id: evidenceId,
      published_at: "2026-11-17T00:00:01+00:00",
    },
    evidence: record,
    humanApproval: "not-recorded",
  };
  vi.mocked(publishSiteEvidenceCandidate).mockResolvedValue(receipt);
  const publish = (raw: unknown = request) =>
    publishSelectedSiteEvidence({ accountId: actor, operationKey: "run:explicit-publish" }, raw);
  return { site, record, request, receipt, publish };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-17T12:00:00Z"));
});
afterEach(() => vi.restoreAllMocks());
describe("unwired exact selected publication", () => {
  it("runs the real assessment and repeats authority before fixed SQL publication", async () => {
    const f = fixture();
    expect(await f.publish()).toMatchObject({ humanApproval: "not-recorded" });
    expect(selectSite).toHaveBeenCalledTimes(2);
    expect(authorizeSelectedSitePublication).toHaveBeenCalledTimes(2);
    expect(selectSitePublishEvidence).toHaveBeenCalledTimes(2);
    expect(publishSiteEvidenceCandidate).toHaveBeenCalledWith({
      accountId: actor,
      ownerId,
      siteId,
      revision: 8,
      evidenceId,
      candidateSha256: f.request.selection.candidateSha256,
      expectedPublishedEvidenceId: null,
      expectedArtistId: artistId,
    });
    expect(insertSiteOverrideEvidence).not.toHaveBeenCalled();
  });
  it("records explicit intent only for the already matched authorized candidate", async () => {
    const f = fixture();
    const override = {
      kind: "override",
      intent: "publish-without-passed-review",
      reason: "Publish this selected preview",
    };
    const record = { ...f.record, ...override };
    delete (record as any).review;
    delete (record as any).reviewSha256;
    vi.mocked(insertSiteOverrideEvidence).mockResolvedValue(record);
    vi.mocked(selectSitePublishEvidence).mockResolvedValue(record);
    f.receipt.evidence = record as any;
    await f.publish({ selection: f.request.selection, evidence: override });
    expect(insertSiteOverrideEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: actor,
        operationKey: "run:explicit-publish",
        candidate: f.site.draft,
        intent: override.intent,
        reason: override.reason,
      }),
    );
  });
  it.each(["revision", "digest", "pointer", "owner", "artist", "missing-pointer"])(
    "rejects changed %s before capture/write",
    async field => {
      const f = fixture();
      if (field === "revision") f.site.revision++;
      if (field === "digest") f.site.draft!.design.experience!.html += "changed";
      if (field === "pointer") f.site.published_evidence_id = actor;
      if (field === "owner") f.site.owner_id = actor;
      if (field === "artist") f.site.artist_id = actor;
      if (field === "missing-pointer") delete (f.site as any).published_evidence_id;
      await expect(f.publish()).rejects.toMatchObject({
        status: field === "missing-pointer" ? 503 : 409,
      });
      expect(insertSiteOverrideEvidence).not.toHaveBeenCalled();
      expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
    },
  );
  it("rejects implicit legacy Publish input", async () => {
    const f = fixture();
    await expect(f.publish({ id: siteId, revision: 8 })).rejects.toThrow();
    expect(selectSite).not.toHaveBeenCalled();
  });
  it.each(["", " ", "\u00a0", "\ufeff"])("rejects empty override reason", async reason => {
    const f = fixture();
    await expect(
      f.publish({
        selection: f.request.selection,
        evidence: { kind: "override", intent: "publish-without-passed-review", reason },
      }),
    ).rejects.toThrow();
    expect(insertSiteOverrideEvidence).not.toHaveBeenCalled();
  });
  it("rejects a different same-revision working preview at final recheck", async () => {
    const f = fixture();
    const changed = structuredClone(f.site.draft!);
    changed.design.experience!.javascript += ";void 1";
    vi.mocked(readPublishableBuild)
      .mockResolvedValueOnce(f.site.draft!)
      .mockResolvedValueOnce(changed);
    await expect(
      f.publish({ ...f.request, selection: { ...f.request.selection, generationToken: "signed" } }),
    ).rejects.toMatchObject({ status: 409 });
    expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
  });
  it.each(["paid", "context", "artist", "workspace", "generation"])(
    "does not fallback after final %s revocation",
    async kind => {
      const f = fixture();
      const error = new Error(kind + " revoked");
      if (kind === "workspace")
        vi.mocked(authorizeSiteWorkspace)
          .mockResolvedValueOnce(ownerId)
          .mockRejectedValueOnce(error);
      else if (kind === "generation")
        vi.mocked(readPublishableBuild)
          .mockResolvedValueOnce(f.site.draft!)
          .mockRejectedValueOnce(error);
      else
        vi.mocked(authorizeSelectedSitePublication)
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(error);
      await expect(
        f.publish(
          kind === "generation"
            ? { ...f.request, selection: { ...f.request.selection, generationToken: "signed" } }
            : f.request,
        ),
      ).rejects.toThrow("revoked");
      expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
    },
  );
  it.each(["failed", "report-hash", "artifact", "foreign-record"])(
    "rejects %s using the actual predicate",
    async kind => {
      const f = fixture();
      if (kind === "failed") {
        f.record.review.verdict = "revise";
        f.record.reviewSha256 = hashSiteEvidence(f.record.review);
      }
      if (kind === "report-hash") f.record.reviewSha256 = "0".repeat(64);
      if (kind === "artifact") {
        f.record.review.verification.evidence.runnerSha256 = "0".repeat(64);
        f.record.reviewSha256 = hashSiteEvidence(f.record.review);
      }
      if (kind === "foreign-record") f.record.ownerId = actor;
      await expect(f.publish()).rejects.toMatchObject({ status: 409 });
      expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
    },
  );
  it("propagates SQL conflict once with the original pointer and key", async () => {
    const f = fixture();
    vi.mocked(publishSiteEvidenceCandidate).mockRejectedValue(new Error("conflict"));
    await expect(f.publish()).rejects.toThrow("conflict");
    expect(publishSiteEvidenceCandidate).toHaveBeenCalledTimes(1);
  });
  it("never treats an override from another actor as this actor's intent", async () => {
    const f = fixture();
    vi.mocked(insertSiteOverrideEvidence).mockResolvedValue({
      ...f.record,
      kind: "override",
      intent: "publish-without-passed-review",
      reason: "Publish now",
      recordedByAccountId: ownerId,
    });
    await expect(
      f.publish({
        selection: f.request.selection,
        evidence: {
          kind: "override",
          intent: "publish-without-passed-review",
          reason: "Publish now",
        },
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
  });
  it.each(["pointer", "artist", "published", "record"])(
    "rejects malformed publication receipt %s without retry",
    async field => {
      const f = fixture();
      if (field === "pointer") f.receipt.site.published_evidence_id = actor;
      if (field === "artist") f.receipt.site.artist_id = actor;
      if (field === "published") {
        f.receipt.site.published = structuredClone(f.site.draft!);
        f.receipt.site.published.design.experience!.html = "changed";
      }
      if (field === "record") f.receipt.evidence = { ...f.record, id: actor };
      await expect(f.publish()).rejects.toMatchObject({ status: 503 });
      expect(publishSiteEvidenceCandidate).toHaveBeenCalledTimes(1);
    },
  );
});

it("rejects missing trusted actor or invalid server key before reads", async () => {
  const f = fixture();
  await expect(
    publishSelectedSiteEvidence({ accountId: "", operationKey: "key" }, f.request),
  ).rejects.toMatchObject({ status: 401 });
  await expect(
    publishSelectedSiteEvidence({ accountId: actor, operationKey: "bad key" }, f.request),
  ).rejects.toMatchObject({ status: 400 });
  expect(selectSite).not.toHaveBeenCalled();
});
it.each(["accountId", "candidate", "operationKey"])(
  "rejects request-body %s authority",
  async field => {
    const f = fixture();
    await expect(f.publish({ ...f.request, [field]: "injected" })).rejects.toThrow();
    expect(selectSite).not.toHaveBeenCalled();
  },
);
it("checks authority before recording explicit override intent", async () => {
  const f = fixture();
  vi.mocked(authorizeSelectedSitePublication).mockRejectedValue(new Error("Access unavailable"));
  await expect(
    f.publish({
      selection: f.request.selection,
      evidence: {
        kind: "override",
        intent: "publish-without-passed-review",
        reason: "Publish now",
      },
    }),
  ).rejects.toThrow("Access unavailable");
  expect(insertSiteOverrideEvidence).not.toHaveBeenCalled();
  expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
});
it("rejects a changed publication pointer at the final boundary", async () => {
  const f = fixture();
  vi.mocked(selectSite)
    .mockResolvedValueOnce(f.site)
    .mockResolvedValueOnce({ ...f.site, published_evidence_id: actor } as Site);
  await expect(f.publish()).rejects.toMatchObject({ status: 409 });
  expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
});
it("propagates final evidence read failures without override or publication", async () => {
  const f = fixture();
  vi.mocked(selectSitePublishEvidence)
    .mockResolvedValueOnce(f.record)
    .mockRejectedValueOnce(new Error("Record unavailable"));
  await expect(f.publish()).rejects.toThrow("Record unavailable");
  expect(insertSiteOverrideEvidence).not.toHaveBeenCalled();
  expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
});
it("does not accept an override record through the review branch", async () => {
  const f = fixture();
  vi.mocked(selectSitePublishEvidence).mockResolvedValue({
    ...f.record,
    kind: "override",
    intent: "publish-without-passed-review",
    reason: "Earlier intent",
  });
  await expect(f.publish()).rejects.toMatchObject({ status: 409 });
  expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
});

it("forwards the selected artist after final read and propagates an artist SQL conflict once", async () => {
  const f = fixture();
  vi.mocked(publishSiteEvidenceCandidate).mockImplementation(async input => {
    expect(input.expectedArtistId).toBe(artistId);
    f.site.artist_id = ownerId; // Concurrent writer after the API read; SQL owns the atomic fence.
    throw Object.assign(new Error("Publication conflict"), { status: 409 });
  });
  await expect(f.publish()).rejects.toMatchObject({ status: 409 });
  expect(publishSiteEvidenceCandidate).toHaveBeenCalledTimes(1);
  expect(insertSiteOverrideEvidence).not.toHaveBeenCalled();
});

it("reports malformed stored evidence as unavailable rather than a raw parser error", async () => {
  const f = fixture();
  vi.mocked(selectSitePublishEvidence).mockResolvedValue({ kind: "review" });
  await expect(f.publish()).rejects.toMatchObject({ status: 503 });
  expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
});
it.each(["reason", "future", "id", "identity"])(
  "rejects override capture receipt %s before publication",
  async failure => {
    const f = fixture();
    const record = {
      ...f.record,
      kind: "override",
      intent: "publish-without-passed-review",
      reason: "Publish now",
    };
    if (failure === "reason") record.reason = "Different intent";
    if (failure === "future") record.recordedAt = "2026-11-18T00:00:00.000000Z";
    if (failure === "id") record.id = "not-a-uuid";
    if (failure === "identity") record.candidateSha256 = "a".repeat(64);
    vi.mocked(insertSiteOverrideEvidence).mockResolvedValue(record);
    await expect(
      f.publish({
        selection: f.request.selection,
        evidence: {
          kind: "override",
          intent: "publish-without-passed-review",
          reason: "Publish now",
        },
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(publishSiteEvidenceCandidate).not.toHaveBeenCalled();
  },
);
