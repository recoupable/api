import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { calculateEntitlements } from "../calculateEntitlements";
import { runDevelopmentEntitlement } from "../runDevelopmentEntitlement";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const request = {
  kind: "entitlement_calculation",
  method_version: "catalog-entitlements-v1",
  case_id: "22222222-2222-4222-8222-222222222222",
  expected_revision: 1,
  assessment_id: "a",
};
describe("disabled-by-default invocation boundary", () => {
  it("refuses before authority or storage when disabled", async () => {
    const rpc = vi.fn();
    await expect(runDevelopmentEntitlement(actor, request, { rpc })).rejects.toThrow("disabled");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("cannot enable production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CATALOG_ENTITLEMENT_DEV", "true");
    const rpc = vi.fn();
    await expect(runDevelopmentEntitlement(actor, request, { rpc })).rejects.toThrow("disabled");
    expect(rpc).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

function receipt() {
  const input = JSON.parse(readFileSync(new URL("./oracle/input.json", import.meta.url), "utf8"));
  const refs = [
    "synthetic-contract:section-4",
    "synthetic-statement:row-2",
    "synthetic-contract:section-5",
    "synthetic-reserve:row-1",
    "synthetic-recoupment:page-1",
    "synthetic-approved-cost:row-1",
  ];
  return {
    case_id: request.case_id,
    revision: 1,
    state: "saved",
    evidence_kind: "customer_assertion",
    withheld_record_ids: [],
    snapshot_usable_for_save: true,
    external_actions: "unsupported",
    created_at: "2026-10-25T00:00:00Z",
    snapshot: {
      schema_version: 1,
      case_id: request.case_id,
      workspace_id: actor,
      revision: 1,
      scope: "synthetic",
      sources: {
        s: {
          id: "s",
          version: "v1",
          sha256: "a".repeat(64),
          locator: "synthetic",
          status: "active",
        },
      },
      assessments: {
        a: {
          id: "a",
          stage: "reconcile",
          status: "prepared",
          rule_version: "supplied-1",
          source_refs: [{ source_id: "s", version: "v1" }],
          data: {
            entitlement_input: input,
            entitlement_evidence_bindings: Object.fromEntries(
              refs.map(r => [r, { source_id: "s", version: "v1" }]),
            ),
          },
        },
      },
      findings: {},
      actions: {},
      attempts: {},
      outcomes: {},
    },
  };
}
function deps(value = receipt()) {
  return {
    rpc: vi.fn(async () => value),
    authorize: vi.fn(async () => ({ accountId: actor, ownerId: actor, organizationId: null })),
  };
}
describe("development selected-case calculation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CATALOG_ENTITLEMENT_DEV", "true");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("computes a separate ephemeral result and reads only", async () => {
    const d = deps();
    const r = await runDevelopmentEntitlement(actor, request, d);
    expect(r.result).toEqual(
      calculateEntitlements(receipt().snapshot.assessments.a.data.entitlement_input),
    );
    expect(r.provenance.input_evidence_kind).toBe("customer_assertion");
    expect(r.provenance.result_kind).toBe("computed_from_supplied_terms");
    expect(r.persisted).toBe(false);
    expect(d.rpc).toHaveBeenCalledExactlyOnceWith("read_context_catalog_case", {
      p_actor: actor,
      p_owner: actor,
      p_case: request.case_id,
      p_revision: null,
    });
    expect(d.authorize).toHaveBeenCalledTimes(2);
  });
  it("denies authority before reading", async () => {
    const d = deps();
    d.authorize.mockRejectedValue(new Error("denied"));
    await expect(runDevelopmentEntitlement(actor, request, d)).rejects.toThrow();
    expect(d.rpc).not.toHaveBeenCalled();
  });
  it("rechecks revoked access after calculation", async () => {
    const d = deps();
    d.authorize
      .mockResolvedValueOnce({ accountId: actor, ownerId: actor, organizationId: null })
      .mockRejectedValueOnce(new Error("revoked"));
    await expect(runDevelopmentEntitlement(actor, request, d)).rejects.toThrow("revoked");
  });
  for (const [name, mutate] of Object.entries({
    assessmentIdentity: (r: any) => {
      r.snapshot.assessments.a.id = "other";
    },
    sourceIdentity: (r: any) => {
      r.snapshot.sources.s.id = "other";
    },
    wrongWorkspace: (r: any) => {
      r.snapshot.workspace_id = "33333333-3333-4333-8333-333333333333";
    },
    wrongRevision: (r: any) => {
      r.revision = 2;
      r.snapshot.revision = 2;
    },
    missingAssessment: (r: any) => {
      r.snapshot.assessments = {};
    },
    stale: (r: any) => {
      r.snapshot.assessments.a.stale = true;
    },
    withdrawn: (r: any) => {
      r.snapshot.sources.s.status = "withdrawn";
    },
    missingInput: (r: any) => {
      delete r.snapshot.assessments.a.data.entitlement_input;
    },
    unboundEvidence: (r: any) => {
      r.snapshot.assessments.a.data.entitlement_evidence_bindings = {};
    },
    partial: (r: any) => {
      r.state = "partial";
      r.snapshot_usable_for_save = false;
    },
    malformedInput: (r: any) => {
      r.snapshot.assessments.a.data.entitlement_input.schema_version = "2";
    },
  }))
    it(name, async () => {
      const r = receipt();
      mutate(r);
      await expect(runDevelopmentEntitlement(actor, request, deps(r))).rejects.toThrow();
    });
  it("rejects caller-provided actor and unsupported methods", async () => {
    for (const extra of [{ account_id: actor }, { method_version: "other" }]) {
      const d = deps();
      await expect(runDevelopmentEntitlement(actor, { ...request, ...extra }, d)).rejects.toThrow();
      expect(d.rpc).not.toHaveBeenCalled();
    }
  });
});
