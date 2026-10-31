import { expect, it, vi } from "vitest";
import { compileContextBrief } from "../compileContextBrief";
import { processContextOperation } from "../processContextOperation";
import { contextBriefSnapshotSchema } from "../contracts/contextBriefResponseSchemas";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const id = (n: number) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
function setup() {
  const doc = {
    id: id(4),
    resultId: id(5),
    ownerId: id(1),
    subjectId: id(3),
    topic: "company_input",
    version: 1,
    status: "accepted" as const,
    evidenceKind: "customer_assertion" as const,
    coverage: "partial" as const,
    text: "Submitted company profile",
    sourceVersionIds: [id(6)],
  };
  const brief = compileContextBrief({
    ownerId: id(1),
    requests: [{ id: id(2), subjectIds: [id(3)] }],
    documents: [doc],
    purpose: "company_onboarding",
    maxCharacters: 12000,
  });
  const snapshot = {
    id: id(7),
    state: "saved",
    superseded: false,
    purpose: "company_onboarding",
    created_at: "2026-10-30T00:00:00Z",
    brief,
  };
  const target = {
    subjectId: id(3),
    kind: "company",
    identityConfirmed: true,
    availableFields: [],
    reusableModules: [],
  };
  const current = [structuredClone(doc)];
  const targets = [target];
  const rpc = vi.fn(async (name: string, _params?: Record<string, unknown>) => {
    if (name === "read_context_brief") return snapshot;
    if (name === "read_context_documents") return current;
    if (name === "list_context_request_targets") return targets;
    throw Error(name);
  });
  const authorize = vi.fn(async () => ({ accountId: id(1), ownerId: id(1), organizationId: null }));
  const dispatch = vi.fn();
  const input = {
    action: "read_brief",
    brief_id: id(7),
    selected_evidence: structuredClone(brief.input_manifest.documents),
  };
  return {
    doc,
    snapshot,
    current,
    targets,
    input,
    rpc,
    authorize,
    dispatch,
    run: () => processContextOperation(id(1), input, { rpc, authorize, dispatch }),
  };
}
it("validates a real saved company evidence selection through read_brief", async () => {
  const f = setup();
  const output = await f.run();
  expect(output).toEqual({
    snapshot: f.snapshot,
    evidence_validation: {
      state: "available",
      documents: [
        {
          documentId: id(4),
          subjectId: id(3),
          kind: "company",
          identityConfirmed: true,
          sourceVersionIds: [id(6)],
        },
      ],
    },
  });
  expect(contextBriefSnapshotSchema.parse(output)).toEqual(output);
  expect(f.rpc).toHaveBeenCalledWith("read_context_documents", {
    p_owner: id(1),
    p_request: id(2),
  });
  expect(f.authorize).toHaveBeenCalledTimes(2);
  expect(f.dispatch).not.toHaveBeenCalled();
});
it("keeps old callers unchanged and performs no additional lookups", async () => {
  const f = setup();
  const output = await processContextOperation(
    id(1),
    { action: "read_brief", brief_id: id(7) },
    { rpc: f.rpc, authorize: f.authorize, dispatch: f.dispatch },
  );
  expect(output).toEqual({ snapshot: f.snapshot });
  expect(f.rpc).toHaveBeenCalledTimes(1);
});
for (const mutation of [
  "superseded",
  "wrong-id",
  "wrong-purpose",
  "manifest-mismatch",
  "current-version",
  "current-source",
  "withdrawn",
  "wrong-owner",
  "missing-doc",
  "unconfirmed",
  "ambiguous-kind",
  "missing-target",
  "request-overflow",
]) {
  it(`returns unavailable for ${mutation}`, async () => {
    const f = setup();
    switch (mutation) {
      case "superseded":
        f.snapshot.superseded = true;
        break;
      case "wrong-id":
        f.snapshot.id = id(8);
        break;
      case "wrong-purpose":
        f.snapshot.purpose = "playlist_pitch";
        break;
      case "manifest-mismatch":
        f.input.selected_evidence[0].topic = "invented";
        break;
      case "current-version":
        f.current[0].version = 2;
        break;
      case "current-source":
        f.current[0].sourceVersionIds = [id(9)];
        break;
      case "withdrawn":
        Object.assign(f.current[0], { status: "withdrawn" });
        break;
      case "wrong-owner":
        f.current[0].ownerId = id(8);
        break;
      case "missing-doc":
        f.current.length = 0;
        break;
      case "unconfirmed":
        f.targets[0].identityConfirmed = false;
        break;
      case "ambiguous-kind":
        f.targets.push({ ...f.targets[0], kind: "recording" });
        break;
      case "missing-target":
        f.targets.length = 0;
        break;
      case "request-overflow":
        f.snapshot.brief.input_manifest.requestIds = Array.from({ length: 11 }, (_, i) =>
          id(i + 20),
        );
        break;
    }
    expect(await f.run()).toMatchObject({ evidence_validation: { state: "unavailable" } });
    expect(f.dispatch).not.toHaveBeenCalled();
    expect(f.rpc.mock.calls.length).toBeLessThanOrEqual(21);
  });
}
it("rejects duplicate selections before storage", async () => {
  const f = setup();
  f.input.selected_evidence.push(f.input.selected_evidence[0]);
  await expect(f.run()).rejects.toThrow();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("preserves authorization failure before and after lookups", async () => {
  const f = setup();
  f.authorize.mockRejectedValueOnce(Error("denied"));
  await expect(f.run()).rejects.toThrow("denied");
  expect(f.rpc).not.toHaveBeenCalled();
  const g = setup();
  g.authorize
    .mockResolvedValueOnce({ accountId: id(1), ownerId: id(1), organizationId: null })
    .mockRejectedValueOnce(Error("revoked"));
  await expect(g.run()).rejects.toThrow("revoked");
});
it("does not attribute a kind from an unrelated request", async () => {
  const f = setup();
  f.snapshot.brief.input_manifest.requestIds.push(id(8));
  f.snapshot.brief.request_ids.push(id(8));
  f.rpc.mockImplementation(async (name, ...rest) => {
    const scope = rest[0] as { p_request?: string } | undefined;
    if (name === "read_context_brief") return f.snapshot;
    if (name === "read_context_documents") return scope?.p_request === id(2) ? f.current : [];
    if (name === "list_context_request_targets") return scope?.p_request === id(8) ? f.targets : [];
    throw Error(name);
  });
  expect(await f.run()).toMatchObject({ evidence_validation: { state: "unavailable" } });
});
it("accepts reordered exact source sets and preserves selection order", async () => {
  const f = setup();
  const second = { ...f.current[0], id: id(9), topic: "catalog_metadata" };
  f.current[0].sourceVersionIds.push(id(10));
  f.snapshot.brief.documents[0].sourceVersionIds = [id(10), id(6)];
  f.snapshot.brief.input_manifest.documents[0].sourceVersionIds = [id(6), id(10)];
  f.input.selected_evidence[0].sourceVersionIds = [id(10), id(6)];
  f.current.push(second);
  f.snapshot.brief.documents.push(second);
  const row = {
    ...f.input.selected_evidence[0],
    documentId: id(9),
    topic: "catalog_metadata",
    sourceVersionIds: second.sourceVersionIds,
  };
  f.snapshot.brief.input_manifest.documents.push(row);
  f.input.selected_evidence.unshift(row);
  expect(await f.run()).toMatchObject({
    evidence_validation: {
      state: "available",
      documents: [{ documentId: id(9) }, { documentId: id(4) }],
    },
  });
});
it("rejects client kind and authority fields before authorization", async () => {
  const f = setup();
  Object.assign(f.input.selected_evidence[0], { kind: "company", authority: "context" });
  await expect(f.run()).rejects.toThrow();
  expect(f.authorize).not.toHaveBeenCalled();
});
it("propagates storage failure instead of reporting available", async () => {
  const f = setup();
  f.rpc.mockRejectedValue(Error("storage failure"));
  await expect(f.run()).rejects.toThrow("storage failure");
});
