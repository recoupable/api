import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const caseId = "33333333-3333-4333-8333-333333333333";
const snapshot = {
  schema_version: 1,
  case_id: caseId,
  workspace_id: owner,
  revision: 0,
  scope: "One supplied work",
  sources: {},
  assessments: {},
  findings: {},
  actions: {},
  attempts: {},
  outcomes: {},
};
const save = {
  action: "save_catalog_case",
  case_id: caseId,
  organization_id: owner,
  expected_revision: 0,
  idempotency_key: "case-1",
  snapshot,
};
const receipt = {
  case_id: caseId,
  revision: 1,
  state: "saved",
  evidence_kind: "customer_assertion",
  snapshot: { ...snapshot, revision: 1 },
  withheld_record_ids: [],
  snapshot_usable_for_save: true,
  external_actions: "unsupported",
  created_at: "2026-10-22T12:00:00Z",
};
function dependencies(output: unknown = receipt) {
  return {
    rpc: vi.fn(async () => output),
    dispatch: vi.fn(),
    authorize: vi.fn(async () => ({ accountId: actor, ownerId: owner, organizationId: owner })),
  };
}
describe("catalog case artifact operations", () => {
  it("saves the exact portable case with authenticated scope and no provider dispatch", async () => {
    const deps = dependencies();
    expect(await processContextOperation(actor, save, deps)).toEqual(receipt);
    expect(deps.authorize).toHaveBeenCalledWith(actor, owner);
    expect(deps.rpc).toHaveBeenCalledExactlyOnceWith("save_context_catalog_case", {
      p_actor: actor,
      p_owner: owner,
      p_case: caseId,
      p_expected_revision: 0,
      p_key: "case-1",
      p_snapshot: snapshot,
    });
    expect(deps.dispatch).not.toHaveBeenCalled();
  });
  it("reads a requested immutable revision", async () => {
    const deps = dependencies();
    await processContextOperation(
      actor,
      { action: "read_catalog_case", case_id: caseId, revision: 1, organization_id: owner },
      deps,
    );
    expect(deps.rpc).toHaveBeenCalledExactlyOnceWith("read_context_catalog_case", {
      p_actor: actor,
      p_owner: owner,
      p_case: caseId,
      p_revision: 1,
    });
  });
  it("lists a bounded page", async () => {
    const page = {
      cases: [
        {
          case_id: caseId,
          revision: 1,
          created_at: receipt.created_at,
          updated_at: receipt.created_at,
        },
      ],
      has_more: false,
      next_id: null,
    };
    const deps = dependencies(page);
    expect(
      await processContextOperation(
        actor,
        { action: "list_catalog_cases", organization_id: owner },
        deps,
      ),
    ).toEqual(page);
    expect(deps.rpc).toHaveBeenCalledExactlyOnceWith("list_context_catalog_cases", {
      p_actor: actor,
      p_owner: owner,
      p_after: null,
      p_limit: 50,
    });
  });
  it("does not reach storage on revoked authorization", async () => {
    const deps = dependencies();
    deps.authorize.mockRejectedValue(new Error("Access denied"));
    await expect(processContextOperation(actor, save, deps)).rejects.toThrow("Access denied");
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { account_id: actor },
    { owner_id: actor },
    { expected_revision: -1 },
    { idempotency_key: "" },
  ])("rejects identity overrides and unbound writes %j", patch => {
    expect(contextOperationSchema.safeParse({ ...save, ...patch }).success).toBe(false);
  });
  it.each([
    { history: [] },
    { actor_id: actor },
    { revision: 3 },
    { case_id: actor },
    { schema_version: 2 },
    {
      findings: {
        f: { id: "f", stage: "audit", status: "paid", source_refs: [], rule_version: "1" },
      },
    },
  ])("rejects unsupported or incompatible snapshot fields %j", patch => {
    expect(
      contextOperationSchema.safeParse({ ...save, snapshot: { ...snapshot, ...patch } }).success,
    ).toBe(false);
  });
  it("binds workspace to the authenticated owner, not the snapshot claim", async () => {
    const deps = dependencies();
    await expect(
      processContextOperation(
        actor,
        { ...save, snapshot: { ...snapshot, workspace_id: actor } },
        deps,
      ),
    ).rejects.toThrow("workspace");
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it("rejects oversized snapshots and collections", () => {
    expect(
      contextOperationSchema.safeParse({
        ...save,
        snapshot: { ...snapshot, scope: "x".repeat(1048577) },
      }).success,
    ).toBe(false);
    const sources = Object.fromEntries(
      Array.from({ length: 1001 }, (_, n) => [
        `s${n}`,
        {
          id: `s${n}`,
          version: "1",
          status: "active",
          sha256: "a".repeat(64),
          locator: "source.csv",
        },
      ]),
    );
    expect(
      contextOperationSchema.safeParse({ ...save, snapshot: { ...snapshot, sources } }).success,
    ).toBe(false);
  });
  it("holds customer assertions without artist, recording or platform identifiers", () => {
    const input = {
      ...save,
      snapshot: {
        ...snapshot,
        findings: {
          missing: {
            id: "missing",
            stage: "organize_publishing",
            status: "open",
            source_refs: [],
            evidence_gap: "No split sheet supplied",
            rule_version: "1",
            cause_id: "missing-split",
          },
        },
      },
    };
    expect(contextOperationSchema.safeParse(input).success).toBe(true);
  });
  it("rejects unbound source references and mismatched dictionary identifiers", () => {
    const source = {
      id: "s",
      version: "v1",
      status: "active",
      sha256: "a".repeat(64),
      locator: "original.csv",
    };
    for (const changes of [
      { sources: { other: source } },
      {
        assessments: {
          a: {
            id: "a",
            stage: "audit",
            status: "complete",
            rule_version: "1",
            source_refs: [{ source_id: "missing", version: "v1" }],
          },
        },
      },
    ]) {
      expect(
        contextOperationSchema.safeParse({ ...save, snapshot: { ...snapshot, ...changes } })
          .success,
      ).toBe(false);
    }
  });
  it("withholds mismatched and malformed storage responses", async () => {
    for (const output of [
      { ...receipt, case_id: actor },
      { ...receipt, snapshot: { ...receipt.snapshot, workspace_id: actor } },
      { ...receipt, revision: 2 },
      { ...receipt, external_actions: "authorized" },
    ]) {
      await expect(processContextOperation(actor, save, dependencies(output))).rejects.toThrow();
    }
  });
  it("returns redacted read snapshots but never accepts them as write input", async () => {
    const output = {
      ...receipt,
      state: "partial",
      snapshot_usable_for_save: false,
      withheld_record_ids: ["s"],
      snapshot: {
        ...receipt.snapshot,
        sources: { s: { id: "s", version: "1", status: "withdrawn", withheld: true } },
      },
    };
    expect(
      await processContextOperation(
        actor,
        { action: "read_catalog_case", case_id: caseId, organization_id: owner },
        dependencies(output),
      ),
    ).toEqual(output);
    expect(
      contextOperationSchema.safeParse({ ...save, expected_revision: 1, snapshot: output.snapshot })
        .success,
    ).toBe(false);
  });
  it("bounds JSON extensions without losing unknown values or accepting non-JSON inputs", () => {
    const source = {
      id: "s",
      version: "1",
      status: "active",
      sha256: "a".repeat(64),
      locator: "file.csv",
    };
    for (const data of [
      { value: Infinity },
      { value: undefined },
      { value: new Date() },
      { value: "x".repeat(1048577) },
    ]) {
      expect(
        contextOperationSchema.safeParse({
          ...save,
          snapshot: { ...snapshot, sources: { s: { ...source, data } } },
        }).success,
      ).toBe(false);
    }
  });
  it("retains stale references but rejects unmarked old versions and dependency cycles", () => {
    const sources = {
      s: { id: "s", version: "2", status: "active", sha256: "a".repeat(64), locator: "file.csv" },
    };
    const a = {
      id: "a",
      stage: "audit",
      status: "complete",
      source_refs: [{ source_id: "s", version: "1" }],
      rule_version: "1",
    };
    expect(
      contextOperationSchema.safeParse({
        ...save,
        snapshot: { ...snapshot, sources, assessments: { a } },
      }).success,
    ).toBe(false);
    expect(
      contextOperationSchema.safeParse({
        ...save,
        snapshot: { ...snapshot, sources, assessments: { a: { ...a, stale: true } } },
      }).success,
    ).toBe(true);
    expect(
      contextOperationSchema.safeParse({
        ...save,
        snapshot: {
          ...snapshot,
          sources,
          assessments: {
            a: { ...a, stale: true, depends_on: ["b"] },
            b: { ...a, id: "b", stale: true, depends_on: ["a"] },
          },
        },
      }).success,
    ).toBe(false);
  });
  it("accepts created-at descending pages whose UUIDs cross the cursor in either direction", async () => {
    const page = {
      cases: [
        {
          case_id: actor,
          revision: 1,
          created_at: "2026-10-21T12:00:00Z",
          updated_at: receipt.created_at,
        },
        {
          case_id: "99999999-9999-4999-8999-999999999999",
          revision: 1,
          created_at: "2026-10-20T12:00:00Z",
          updated_at: receipt.created_at,
        },
      ],
      has_more: true,
      next_id: "99999999-9999-4999-8999-999999999999",
    };
    expect(
      await processContextOperation(
        actor,
        {
          action: "list_catalog_cases",
          organization_id: owner,
          after_id: caseId,
          limit: 2,
        },
        dependencies(page),
      ),
    ).toEqual(page);
    await expect(
      processContextOperation(
        actor,
        {
          action: "list_catalog_cases",
          organization_id: owner,
          after_id: actor,
          limit: 2,
        },
        dependencies(page),
      ),
    ).rejects.toThrow("page scope");
  });
  it("requires structurally bounded action payloads while retaining expired authorization assertions", () => {
    const payload = {
      provider: "Synthetic society",
      operation: "register",
      account: "account-one",
      party: "party-one",
      subjects: ["work-one"],
      scope: { territory: "US" },
      disclosure: [],
      costs: [],
    };
    const action = {
      id: "action-one",
      stage: "register",
      status: "authorized",
      source_refs: [],
      evidence_gap: "Historical imported authorization assertion",
      rule_version: "1",
      payload,
      authorization: {
        reference: "Historical assertion",
        payload_sha256: "a".repeat(64),
        valid_until: "2020-01-01T00:00:00Z",
        scope: payload.scope,
      },
    };
    const input = (change: Record<string, unknown>) => ({
      ...save,
      snapshot: {
        ...snapshot,
        actions: { "action-one": { ...action, payload: { ...payload, ...change } } },
      },
    });
    expect(contextOperationSchema.safeParse(input({})).success).toBe(true);
    for (const change of [
      { provider: "" },
      { operation: " " },
      { account: {} },
      { party: null },
      { subjects: [] },
      { subjects: [""] },
      { subjects: "work-one" },
      { scope: {} },
      { scope: [] },
      { disclosure: {} },
      { costs: "unknown" },
    ])
      expect(contextOperationSchema.safeParse(input(change)).success).toBe(false);
  });
});
