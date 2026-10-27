import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileContextBrief } from "../compileContextBrief";
import { processContextOperation } from "../processContextOperation";
import { catalogCaseSnapshotSchema } from "../catalogCaseSnapshotSchema";
import { readRetainedContextSourceVersions } from "@/lib/supabase/context_source_versions/readRetainedContextSourceVersions";

vi.mock("@/lib/supabase/context_source_versions/readRetainedContextSourceVersions", () => ({
  readRetainedContextSourceVersions: vi.fn(),
}));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const briefId = "33333333-3333-4333-8333-333333333333";
const request = "44444444-4444-4444-8444-444444444444";
const sourceIds = ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"];
const document = {
  id: "77777777-7777-4777-8777-777777777777",
  resultId: "88888888-8888-4888-8888-888888888888",
  ownerId: owner,
  subjectId: "99999999-9999-4999-8999-999999999999",
  topic: "company_input",
  version: 1,
  status: "accepted" as const,
  evidenceKind: "customer_assertion" as const,
  text: "Private selected evidence. Identity and rights are unconfirmed.",
  sourceVersionIds: sourceIds,
  coverage: "partial" as const,
};
function saved() {
  return {
    id: briefId,
    created_at: "2026-10-26T00:00:00Z",
    purpose: "company_onboarding",
    state: "saved",
    superseded: false,
    brief: compileContextBrief({
      ownerId: owner,
      requests: [{ id: request, subjectIds: [document.subjectId] }],
      documents: [structuredClone(document)],
      purpose: "company_onboarding",
      maxCharacters: 12000,
    }),
  };
}
const input = { action: "prepare_catalog_audit", brief_id: briefId, organization_id: owner };
const rpc = vi.fn();
const dispatch = vi.fn();
const authorize = vi.fn();
const prepare = () => processContextOperation(actor, input, { rpc, dispatch, authorize });
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue(saved());
  authorize.mockResolvedValue({ accountId: actor, ownerId: owner, organizationId: owner });
  vi.mocked(readRetainedContextSourceVersions).mockResolvedValue(
    sourceIds.map((id, index) => ({ id, fingerprint: (index ? "b" : "a").repeat(64) })),
  );
});
describe("prepare a catalog audit from selected saved evidence", () => {
  it("returns a new save-compatible draft using actual hashes and every source without a write", async () => {
    const result = (await prepare()) as { snapshot: unknown };
    expect(result).toMatchObject({
      state: "prepared",
      persisted: false,
      external_actions: "unsupported",
    });
    const snapshot = catalogCaseSnapshotSchema.parse(result.snapshot);
    expect(snapshot).toMatchObject({
      revision: 0,
      workspace_id: owner,
      scope: "Catalog audit of selected saved evidence",
      actions: {},
      attempts: {},
      outcomes: {},
      findings: {},
    });
    expect(snapshot.case_id).not.toBe(briefId);
    expect(Object.keys(snapshot.sources)).toEqual(sourceIds.map(id => `source:${id}`));
    sourceIds.forEach((id, index) =>
      expect(snapshot.sources[`source:${id}`]).toEqual({
        id: `source:${id}`,
        version: id,
        sha256: (index ? "b" : "a").repeat(64),
        locator: { kind: "context_source_version", source_version_id: id },
        context_source_version_id: id,
        status: "active",
        evidence_kind: "retained_context_source",
      }),
    );
    expect(snapshot.assessments["assessment:context"]).toMatchObject({
      stage: "audit",
      status: "partial",
      summary: saved().brief.text,
      source_refs: sourceIds.map(id => ({ source_id: `source:${id}`, version: id })),
      rule_version: "context-catalog-audit-v1",
      evidence_gap: expect.stringContaining("selected saved evidence"),
      data: {
        brief_id: briefId,
        request_ids: [request],
        input_manifest: saved().brief.input_manifest,
      },
    });
    expect(readRetainedContextSourceVersions).toHaveBeenCalledExactlyOnceWith(owner, sourceIds);
    expect(rpc.mock.calls).toEqual(
      [1, 2].map(() => ["read_context_brief", { p_owner: owner, p_brief: briefId }]),
    );
    expect(dispatch).not.toHaveBeenCalled();
    expect(authorize).toHaveBeenCalledTimes(3);
    const next = (await prepare()) as { snapshot: { case_id: string } };
    expect(next.snapshot.case_id).not.toBe(snapshot.case_id);
  });
  it.each([
    ["missing", () => null],
    ["unavailable", () => ({ ...saved(), state: "unavailable", brief: null })],
    ["superseded", () => ({ ...saved(), superseded: true })],
    ["wrong brief", () => ({ ...saved(), id: request })],
    ["wrong purpose", () => ({ ...saved(), purpose: "playlist_pitch" })],
    [
      "wrong inner purpose",
      () => {
        const s = saved();
        s.brief.purpose = "playlist_pitch";
        return s;
      },
    ],
    [
      "foreign owner",
      () => {
        const s = saved();
        s.brief.documents[0].ownerId = actor;
        return s;
      },
    ],
    [
      "no documents",
      () => {
        const s = saved();
        s.brief.documents = [];
        return s;
      },
    ],
    [
      "no sources",
      () => {
        const s = saved();
        s.brief.documents[0].sourceVersionIds = [];
        return s;
      },
    ],
    [
      "no result",
      () => {
        const s = saved();
        delete s.brief.documents[0].resultId;
        return s;
      },
    ],
    ["incomplete schema", () => ({ ...saved(), brief: { text: "private incomplete output" } })],
    [
      "manifest mismatch",
      () => {
        const s = saved();
        s.brief.input_manifest.documents = [];
        return s;
      },
    ],
  ])("rejects %s briefs before looking up sources", async (_name, mutate) => {
    rpc.mockResolvedValue(mutate());
    await expect(prepare()).rejects.toThrow();
    expect(readRetainedContextSourceVersions).not.toHaveBeenCalled();
  });
  it("fails closed when an exact source version is unavailable", async () => {
    vi.mocked(readRetainedContextSourceVersions).mockRejectedValue(
      new Error("Retained sources unavailable"),
    );
    await expect(prepare()).rejects.toThrow("Retained sources unavailable");
    expect(dispatch).not.toHaveBeenCalled();
  });
  it.each(["membership", "source", "superseded", "changed"])(
    "rechecks %s after asynchronous source reads",
    async mode => {
      if (mode === "membership")
        authorize
          .mockResolvedValueOnce({ ownerId: owner })
          .mockResolvedValueOnce({ ownerId: owner })
          .mockRejectedValueOnce(new Error("Access denied"));
      else {
        const changed = saved();
        if (mode === "superseded") changed.superseded = true;
        if (mode === "changed") changed.brief.text = "changed while reading";
        rpc
          .mockResolvedValueOnce(saved())
          .mockResolvedValueOnce(
            mode === "source" ? { ...changed, state: "unavailable", brief: null } : changed,
          );
      }
      await expect(prepare()).rejects.toThrow();
    },
  );
  it("rejects spoofed request fields before authorization", async () => {
    await expect(
      processContextOperation(actor, { ...input, account_id: actor }, { rpc, dispatch, authorize }),
    ).rejects.toThrow();
    expect(authorize).not.toHaveBeenCalled();
  });
  it("retains the shared 1 MiB output boundary", async () => {
    const oversized = saved();
    oversized.brief.gaps = Array.from({ length: 40 }, () => ({
      requestId: request,
      topic: "catalog_metadata",
      subjectId: null,
      status: "unavailable",
      reason: "x".repeat(32000),
    }));
    rpc.mockResolvedValue(oversized);
    await expect(prepare()).rejects.toThrow("Snapshot exceeds 1 MiB");
  });
  it("does not query saved evidence after initial workspace denial", async () => {
    authorize.mockRejectedValue(new Error("Access denied"));
    await expect(prepare()).rejects.toThrow("Access denied");
    expect(rpc).not.toHaveBeenCalled();
    expect(readRetainedContextSourceVersions).not.toHaveBeenCalled();
  });
  it("withholds incomplete source results rather than dropping a dependency", async () => {
    vi.mocked(readRetainedContextSourceVersions).mockResolvedValue([
      { id: sourceIds[0], fingerprint: "a".repeat(64) },
    ]);
    await expect(prepare()).rejects.toThrow("Reference must identify an active source version");
  });
  it("keeps a ready selected brief explicitly partial as a catalog audit", async () => {
    const ready = saved();
    ready.brief.readiness = "ready";
    rpc.mockResolvedValue(ready);
    expect(await prepare()).toMatchObject({
      snapshot: {
        assessments: { "assessment:context": { status: "partial", data: { readiness: "ready" } } },
      },
    });
  });
});
