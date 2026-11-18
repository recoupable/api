import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fixtureSql, literal, rpc, state, resetTransport } from "./transport";
import { networkAttempts } from "./network-deny";
import { captureSavedSiteReview } from "@/lib/sites/production/captureSavedSiteReview";
import { assessStoredSitePublishEvidence } from "@/lib/sites/production/assessStoredSitePublishEvidence";
import { publishSelectedSiteEvidence } from "@/lib/sites/production/publication/publishSelectedSiteEvidence";
import { selectSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/selectSitePublishEvidence";
import { insertSitePublishEvidence } from "@/lib/supabase/site_publish_evidence/insertSitePublishEvidence";
import { publishSiteEvidenceCandidate } from "@/lib/supabase/site_publish_evidence/publishSiteEvidenceCandidate";
import { serializeSiteEvidence } from "@/lib/sites/production/serializeSiteEvidence";
import type { Site, SiteSnapshot } from "@/lib/sites/schema";

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    schema: (name: string) => {
      expect(name).toBe("sites_evidence_proposal");
      return { rpc };
    },
  },
}));
vi.mock("@/lib/supabase/sites/selectSite", () => ({
  selectSite: async (id: string) =>
    JSON.parse(fixtureSql(`SELECT to_jsonb(s) FROM sites s WHERE id=${literal(id)}`) || "null"),
}));
// Synthetic external reads: deliberately permissive to let real SQL reject foreign actors.
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: async () => !state.denyWorkspace,
}));
vi.mock("@/lib/sites/production/readPublishableBuild", () => ({
  readPublishableBuild: async () => {
    throw new Error("Preview seam not exercised");
  },
}));
vi.mock("@/lib/sites/production/readSiteContextBrief", () => ({
  readSiteContextBrief: async () => ({ synthetic: true }),
}));
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: async () => [{ organization_id: owner }],
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: async () => false,
}));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: async () => [{ name: "Synthetic artist" }],
}));
vi.mock("@/lib/supabase/site_fan_connections/selectFanConfig", () => ({
  selectFanConfig: async (id: string) => ({
    site_id: id,
    enabled: true,
    return_url: "https://fixture.invalid/return",
  }),
}));
vi.mock("@/lib/sites/fanConnection/readPaidSiteSubscription", () => ({
  readPaidSiteSubscription: async () => true,
}));
vi.mock("@/lib/sites/fanConnection/getFanOAuthConfig", () => ({
  getFanOAuthConfig: () => ({ synthetic: true }),
}));

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uid(1),
  actor = uid(2),
  foreign = uid(4),
  artist = uid(5),
  siteId = uid(10);
const suite = process.env.SITES_BRIDGE_SOCKET ? describe : describe.skip;
let vector: {
  candidate: SiteSnapshot;
  candidateCanonical: string;
  candidateSha256: string;
  review: unknown;
  reviewCanonical: string;
  reviewSha256: string;
};
function row(): Site {
  return JSON.parse(fixtureSql(`SELECT to_jsonb(s) FROM sites s WHERE id=${literal(siteId)}`));
}
function snapshot() {
  return fixtureSql(
    `SELECT jsonb_build_object('sites',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM sites s),'evidence',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM sites_evidence_proposal.records e))`,
  );
}
function seed(v: typeof vector) {
  vector = structuredClone(v);
  const candidate = structuredClone(vector.candidate);
  candidate.production!.reviews = [vector.review as never];
  fixtureSql(
    `TRUNCATE sites CASCADE; DELETE FROM account_organization_ids; INSERT INTO accounts(id,name) VALUES ${[1, 2, 3, 4, 5, 6].map(n => `(${literal(uid(n))},'Synthetic')`).join(",")} ON CONFLICT DO NOTHING; INSERT INTO account_organization_ids(account_id,organization_id) VALUES (${literal(actor)},${literal(owner)}); INSERT INTO sites(id,owner_id,created_by,artist_id,name,revision,draft) VALUES (${literal(siteId)},${literal(owner)},${literal(actor)},${literal(artist)},'Synthetic',2,${literal(candidate)}::jsonb);`,
  );
}
function capture(accountId = actor, key = "capture") {
  return captureSavedSiteReview({ accountId, savedSite: row(), operationKey: key });
}
function selection() {
  return {
    siteId,
    ownerId: owner,
    artistId: artist,
    revision: 2,
    candidateSha256: vector.candidateSha256,
    expectedPublishedEvidenceId: null,
  };
}
function publish(id: string, accountId = actor) {
  return publishSelectedSiteEvidence(
    { accountId, operationKey: "publish:original" },
    { selection: selection(), evidence: { kind: "review", evidenceId: id } },
  );
}
function direct(id: string, accountId = actor, ownerId = owner) {
  return publishSiteEvidenceCandidate({
    accountId,
    ownerId,
    siteId,
    revision: 2,
    evidenceId: id,
    candidateSha256: vector.candidateSha256,
    expectedPublishedEvidenceId: null,
    expectedArtistId: artist,
  });
}

suite("actual Sites API to pinned SQL (synthetic transport)", () => {
  let vectors: (typeof vector)[];
  beforeEach(() => {
    resetTransport();
    vectors = JSON.parse(readFileSync(process.env.SITES_BRIDGE_VECTORS!, "utf8")).vectors;
    seed(vectors[0]);
  });
  afterEach(() => {
    expect(networkAttempts).toEqual([]);
  });
  it.each([0, 1])("captures, reads, assesses and publishes exact JS vector %s", async index => {
    seed(vectors[index]);
    const saved = row();
    const record = await capture();
    const replay = await capture();
    expect(replay).toEqual(record);
    const read = await selectSitePublishEvidence({
      accountId: actor,
      ownerId: owner,
      siteId,
      evidenceId: record.id,
    });
    expect(read).toEqual(record);
    expect(
      await assessStoredSitePublishEvidence(actor, { siteId, revision: 2, evidenceId: record.id }),
    ).toMatchObject({ status: "satisfied" });
    const stored = JSON.parse(
      fixtureSql(
        `SELECT to_jsonb(e) FROM sites_evidence_proposal.records e WHERE id=${literal(record.id)}`,
      ),
    );
    expect(stored.candidate_canonical).toBe(vector.candidateCanonical);
    expect(stored.candidate_sha256).toBe(vector.candidateSha256);
    expect(stored.review_canonical).toBe(vector.reviewCanonical);
    expect(record).toMatchObject({ reviewSha256: vector.reviewSha256 });
    expect(serializeSiteEvidence(stored.candidate)).toBe(serializeSiteEvidence(saved.draft));
    const result = await publish(record.id);
    expect(result).toMatchObject({ humanApproval: "not-recorded", evidence: record });
    expect(row()).toMatchObject({
      revision: 2,
      published_evidence_id: record.id,
      published: saved.draft,
    });
    expect(state.calls.filter(c => c.name === "publish_candidate")).toHaveLength(1);
  });
  it("records explicit override and publishes through actual authority and assessment", async () => {
    const result = await publishSelectedSiteEvidence(
      { accountId: actor, operationKey: "override:original" },
      {
        selection: selection(),
        evidence: {
          kind: "override",
          intent: "publish-without-passed-review",
          reason: "Explicit synthetic choice",
        },
      },
    );
    expect(result.evidence).toMatchObject({
      kind: "override",
      recordedByAccountId: actor,
      reason: "Explicit synthetic choice",
    });
    expect(row()).toMatchObject({ revision: 2, published_evidence_id: result.evidence.id });
    expect(state.calls.map(c => c.name)).toEqual([
      "record_evidence",
      "read_evidence",
      "read_evidence",
      "publish_candidate",
    ]);
  });
  it("rejects API workspace preflight without any RPC", async () => {
    state.denyWorkspace = true;
    await expect(capture()).rejects.toMatchObject({ status: 403 });
    expect(state.calls).toHaveLength(0);
  });
  it("executes SQL foreign-actor capture/read/publication denials with no writes", async () => {
    const r = await capture();
    const before = snapshot();
    await expect(capture(foreign, "foreign")).rejects.toMatchObject({ status: 403 });
    await expect(
      selectSitePublishEvidence({ accountId: foreign, ownerId: owner, siteId, evidenceId: r.id }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(direct(r.id, foreign)).rejects.toMatchObject({ status: 403 });
    expect(state.errors).toEqual(["42501", "42501", "42501"]);
    expect(snapshot()).toBe(before);
  });
  it("executes SQL foreign owner and site read denials", async () => {
    const r = await capture();
    const before = snapshot();
    for (const scope of [
      { ownerId: foreign, siteId },
      { ownerId: owner, siteId: uid(11) },
    ])
      await expect(
        selectSitePublishEvidence({ accountId: actor, ...scope, evidenceId: r.id }),
      ).rejects.toMatchObject({ status: 403 });
    expect(state.errors).toEqual(["42501", "42501"]);
    expect(snapshot()).toBe(before);
  });
  it("maps actual duplicate-key conflict to 409 without mutation", async () => {
    await capture();
    const before = snapshot();
    await expect(
      insertSitePublishEvidence({
        accountId: actor,
        ownerId: owner,
        siteId,
        revision: 2,
        operationKey: "capture",
        candidate: row().draft!,
        review: { verdict: "fail" },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.errors).toEqual(["23505"]);
    expect(snapshot()).toBe(before);
  });
  it.each(["revision", "pointer", "artist"])(
    "SQL fences stale %s after final API reads",
    async field => {
      const r = await capture();
      let before = "";
      state.beforePublish = () => {
        fixtureSql(
          field === "revision"
            ? `UPDATE sites SET revision=revision+1 WHERE id=${literal(siteId)}`
            : field === "artist"
              ? `UPDATE sites SET artist_id=${literal(uid(6))} WHERE id=${literal(siteId)}`
              : `SET ROLE service_role; SELECT sites_evidence_proposal.publish_candidate(${literal(actor)},${literal(owner)},${literal(siteId)},2,${literal(r.id)},${literal(vector.candidateSha256)},NULL,${literal(artist)});`,
        );
        if (field === "pointer") expect(row()).toMatchObject({ published_evidence_id: r.id });
        before = snapshot();
      };
      await expect(publish(r.id)).rejects.toMatchObject({ status: 409 });
      expect(state.errors).toEqual(["40001"]);
      expect(snapshot()).toBe(before);
      const call = state.calls.at(-1)!;
      expect(call.name).toBe("publish_candidate");
      expect(Object.keys(call.args)).toHaveLength(8);
      expect(call.args.p_expected_artist_id).toBe(artist);
    },
  );
  it.each(["lost", "tamper", "null"])("does not retry after committed %s receipt", async fault => {
    const r = await capture();
    state.afterPublish = fault;
    const beforeCalls = state.calls.length;
    if (fault === "lost")
      await expect(publish(r.id)).rejects.toThrow("Synthetic postcommit response loss");
    else await expect(publish(r.id)).rejects.toMatchObject({ status: 503 });
    expect(row()).toMatchObject({ published_evidence_id: r.id, revision: 2 });
    expect(state.calls.slice(beforeCalls).map(c => c.name)).toEqual([
      "read_evidence",
      "read_evidence",
      "publish_candidate",
    ]);
    expect(
      JSON.parse(
        fixtureSql("SELECT jsonb_agg(operation_key) FROM sites_evidence_proposal.records"),
      ),
    ).toEqual(["capture"]);
  });
});
