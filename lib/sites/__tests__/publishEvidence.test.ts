import { describe, expect, it, vi } from "vitest";
import { assessSitePublishEvidence } from "../production/assessSitePublishEvidence";
import { getSitePublishIdentity } from "../production/getSitePublishIdentity";
import { prepareSiteRenderArtifacts } from "../production/prepareSiteRenderArtifacts";
import { hashSiteEvidence } from "../production/hashSiteEvidence";
import type { SiteSnapshot } from "../schema";
import type { ExperienceContract } from "../production/experienceContract";

const candidate = {
  name: "Fixture",
  releaseUrl: "",
  assets: [],
  design: { experience: { html: "<button>Start</button>", css: "", javascript: "void 0" } },
} as SiteSnapshot;
const journey: ExperienceContract = {
  releaseConnection: "A concrete connection to the release",
  evidence: ["Song analysis"],
  motivation: "Discover an ending by participating",
  payoff: "An ending reflecting the chosen activity",
  capabilities: ["browser-interaction"],
  steps: ["participate", "result", "delivery"].map(checkpoint => ({
    action: "click" as const,
    target: "Start",
    value: "",
    expected: "",
    checkpoint: checkpoint as "participate" | "result" | "delivery",
  })),
};
function fixture() {
  const context = {
    siteId: "site",
    ownerId: "workspace",
    revision: 2,
    candidate: structuredClone(candidate),
  };
  const review = {
    verdict: "pass",
    issues: [],
    summary: "Offline fixture only",
    verification: {
      scope: "generated-experience",
      humanApproval: "not-recorded",
      nativeShareDelivery: "not-tested",
      spotifyAuthentication: "not-tested",
      journey,
      evidence: prepareSiteRenderArtifacts(candidate, journey).evidence,
      viewports: ["mobile", "desktop"].map(name => ({
        name,
        journeyPassed: true,
        errors: [],
        overflow: false,
      })),
    },
  };
  const record = {
    id: "record",
    ...getSitePublishIdentity(context),
    recordedAt: "2026-11-17T12:00:00.000Z",
    recordedByAccountId: "actor",
    kind: "review",
    review,
    reviewSha256: hashSiteEvidence(review),
  };
  const server = {
    accountId: "actor",
    readCandidate: vi.fn(async () => context),
    readEvidence: vi.fn(async (): Promise<unknown> => record),
    now: () => Date.parse("2026-11-17T13:00:00.000Z"),
  };
  const request = { siteId: "site", revision: 2, evidenceId: "record" };
  const assess = () => assessSitePublishEvidence(request, server);
  const rehash = () => {
    record.reviewSha256 = hashSiteEvidence(record.review);
  };
  return { context, record, server, request, assess, rehash };
}
describe("unwired exact-candidate publication assessment", () => {
  it("accepts a server-read bound report without claiming human approval", async () => {
    const f = fixture();
    expect(await f.assess()).toMatchObject({
      status: "satisfied",
      basis: "review",
      evidenceId: "record",
      humanApproval: "not-recorded",
    });
    expect(f.server.readCandidate).toHaveBeenCalledWith({ siteId: "site", accountId: "actor" });
    expect(f.server.readEvidence).toHaveBeenCalledWith({
      evidenceId: "record",
      siteId: "site",
      ownerId: "workspace",
    });
  });
  it.each(["siteId", "ownerId", "revision", "candidateSha256", "id"])(
    "rejects a mismatched %s",
    async field => {
      const f = fixture();
      Object.assign(f.record, { [field]: field === "revision" ? 3 : "other" });
      expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
    },
  );
  it.each(["recordedAt", "recordedByAccountId", "candidateSha256", "reviewSha256"])(
    "rejects inherited missing %s",
    async field => {
      const f = fixture();
      delete (f.record as Record<string, unknown>)[field];
      expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
    },
  );
  it.each(["sourceSha256", "journeySha256", "runnerSha256"])(
    "rejects changed %s even with a matching report digest",
    async field => {
      const f = fixture();
      Object.assign(f.record.review.verification.evidence, { [field]: "0".repeat(64) });
      f.rehash();
      expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
    },
  );
  it("rejects candidate bytes changed within the same revision", async () => {
    const f = fixture();
    f.context.candidate.design.experience!.javascript = "void 1";
    expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
  });
  it("accepts a persisted JSON round trip but rejects a failed verdict", async () => {
    const f = fixture();
    f.server.readEvidence.mockResolvedValue(JSON.parse(JSON.stringify(f.record)));
    expect(await f.assess()).toMatchObject({ status: "satisfied" });
    f.record.review.verdict = "revise";
    f.rehash();
    f.server.readEvidence.mockResolvedValue(f.record);
    expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
  });
  it("rejects an absent report without throwing", async () => {
    const f = fixture();
    const { review: _review, ...incomplete } = f.record;
    f.server.readEvidence.mockResolvedValue(incomplete);
    expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
  });
  it("rejects changed report bytes", async () => {
    const f = fixture();
    f.record.review.summary = "changed";
    expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
  });
  it.each([
    "failed",
    "errors",
    "overflow",
    "missing",
    "duplicate",
    "blocked",
    "direction",
    "legacy",
    "opening",
  ])("rejects %s evidence despite its pass label", async failure => {
    const f = fixture();
    const v = f.record.review.verification;
    if (failure === "failed") v.viewports[0].journeyPassed = false;
    if (failure === "errors") (v.viewports[0].errors as string[]).push("failure");
    if (failure === "overflow") v.viewports[0].overflow = true;
    if (failure === "missing") v.viewports.pop();
    if (failure === "duplicate") v.viewports.push(v.viewports[0]);
    if (failure === "blocked") Object.assign(f.record.review, { blocked: "credits" });
    if (failure === "direction")
      Object.assign(f.record.review, {
        issues: [{ severity: "minor", module: "direction", detail: "change", fix: "change" }],
      });
    if (failure === "legacy") delete (v as Record<string, unknown>).humanApproval;
    if (failure === "opening") Object.assign(v, { opening: { verdict: "revise" } });
    f.rehash();
    expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
  });
  it("rejects a stale requested revision before reading evidence", async () => {
    const f = fixture();
    f.request.revision = 1;
    expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
    expect(f.server.readEvidence).not.toHaveBeenCalled();
  });
  it("does not convert access or persistence failures into an override", async () => {
    const f = fixture();
    f.server.readCandidate.mockRejectedValue(new Error("Access denied"));
    await expect(f.assess()).rejects.toThrow("Access denied");
    const stored = fixture();
    stored.server.readEvidence.mockRejectedValue(new Error("Evidence unavailable"));
    await expect(stored.assess()).rejects.toThrow("Evidence unavailable");
  });
  it("rejects a supplied incomplete opening pass", async () => {
    const f = fixture();
    Object.assign(f.record.review.verification, { opening: { verdict: "pass", issues: [] } });
    f.rehash();
    expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
    Object.assign(f.record.review.verification, {
      opening: {
        verdict: "pass",
        issues: [],
        summary: "Opening fixture",
        observations: ["mobile", "desktop"].map(viewport => ({
          viewport,
          invitation: "Start",
          firstAction: "Start",
          expectedResponse: "Result",
        })),
      },
    });
    f.rehash();
    expect(await f.assess()).toMatchObject({ status: "satisfied" });
  });
  it("accepts an explicit server-recorded override with no review", async () => {
    const f = fixture();
    const { review: _review, reviewSha256: _hash, ...base } = f.record;
    f.server.readEvidence.mockResolvedValue({
      ...base,
      kind: "override",
      intent: "publish-without-passed-review",
      reason: "Publish this working preview now",
    });
    expect(await f.assess()).toMatchObject({
      status: "satisfied",
      basis: "override",
      humanApproval: "not-recorded",
    });
  });
  it.each(["foreign-actor", "future", "implicit", "empty-reason", "no-record"])(
    "rejects %s override provenance",
    async failure => {
      const f = fixture();
      const { review: _review, reviewSha256: _hash, ...base } = f.record;
      const override = {
        ...base,
        kind: "override",
        intent: "publish-without-passed-review",
        reason: "Publish now",
      };
      if (failure === "foreign-actor") override.recordedByAccountId = "other";
      if (failure === "future") override.recordedAt = "2026-11-18T12:00:00.000Z";
      if (failure === "implicit") override.intent = "publish";
      if (failure === "empty-reason") override.reason = " ";
      f.server.readEvidence.mockResolvedValue(failure === "no-record" ? null : override);
      expect(await f.assess()).toMatchObject({ status: "unsatisfied" });
    },
  );
  it("hashes JSON key order consistently but preserves array order", () => {
    expect(hashSiteEvidence({ b: 2, a: 1 })).toBe(hashSiteEvidence({ a: 1, b: 2 }));
    expect(hashSiteEvidence([1, 2])).not.toBe(hashSiteEvidence([2, 1]));
  });
});
