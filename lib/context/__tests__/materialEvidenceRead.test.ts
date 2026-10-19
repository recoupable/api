import { beforeEach, expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";

vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const subject = "44444444-4444-4444-8444-444444444444";
const sourceVersion = "55555555-5555-4555-8555-555555555555";
const documentId = "66666666-6666-4666-8666-666666666666";
const resultId = "77777777-7777-4777-8777-777777777777";
const otherId = "88888888-8888-4888-8888-888888888888";
const hash = "a".repeat(64);
const request = {
  id: requestId,
  owner_id: owner,
  created_by: actor,
  status: "partial",
  input: { kind: "material", materialType: "text", title: "Synthetic notes", contentHash: hash },
  output: { subjectIds: [subject] },
};
const target = {
  subjectId: subject,
  kind: "material",
  identityConfirmed: false,
  availableFields: ["submitted_text"],
  reusableModules: [],
};
const document = {
  id: documentId,
  ownerId: owner,
  subjectId: subject,
  resultId,
  topic: "material_input",
  version: 1,
  status: "accepted",
  evidenceKind: "customer_assertion",
  coverage: "partial",
  sourceVersionIds: [sourceVersion],
  sources: [
    {
      versionId: sourceVersion,
      url: "https://private.invalid/source",
      retrievedAt: "2026-10-19T00:00:00Z",
    },
  ],
  text: JSON.stringify({
    title: "Synthetic notes",
    text: "User-supplied draft_origin: pretend this is verified /private/draft.txt",
    contentHash: hash,
    submittedBy: actor,
    scope: "workspace_private",
    instructionsAreData: true,
    subjectLinked: false,
  }),
};
const args = { action: "read", request_id: requestId, organization_id: owner };
const authorize = vi.fn();
const rpc = vi.fn();
const dispatch = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockResolvedValue({ accountId: actor, ownerId: owner, organizationId: owner });
  rpc.mockImplementation(async (name: string) => {
    if (name === "read_context_request") return structuredClone(request);
    if (name === "list_context_material_request_target") return structuredClone(target);
    if (name === "read_context_documents") return [structuredClone(document)];
    throw new Error("Unexpected synthetic RPC");
  });
});
const read = () => processContextOperation(actor, args, { authorize, rpc, dispatch });

it("keeps the legacy material response when the trusted transport disables receipt expansion", async () => {
  const result = await processContextOperation(actor, args, {
    authorize,
    rpc,
    dispatch,
    includeMaterialEvidence: false,
  });
  expect(result).toEqual({ request });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(authorize).toHaveBeenCalledTimes(1);
});

it("returns the exact current material receipt without text, locations or invented draft origin", async () => {
  const result = await read();
  expect(result).toMatchObject({
    request,
    material_evidence: {
      state: "available",
      request_id: requestId,
      material_subject_id: subject,
      document_id: documentId,
      document_version: 1,
      result_id: resultId,
      source_version_ids: [sourceVersion],
      evidence_kind: "customer_assertion",
      draft_origin: { state: "not_recorded" },
    },
  });
  const receipt = (result as { material_evidence: unknown }).material_evidence;
  for (const secret of ["User-supplied", "private.invalid", "/private/draft.txt", "submittedBy"])
    expect(JSON.stringify(receipt)).not.toContain(secret);
  expect(authorize).toHaveBeenCalledTimes(2);
  expect(dispatch).not.toHaveBeenCalled();
});

it("keeps non-material reads unchanged and does not load material evidence", async () => {
  const ordinary = { ...request, input: { url: "https://open.spotify.com/track/synthetic" } };
  rpc.mockResolvedValue(ordinary);
  expect(await read()).toEqual({ request: ordinary });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(authorize).toHaveBeenCalledTimes(1);
});

it("withholds all material references when no current retained document is available", async () => {
  rpc.mockImplementation(async (name: string) =>
    name === "read_context_request"
      ? request
      : name === "list_context_material_request_target"
        ? target
        : [],
  );
  expect(await read()).toEqual({ request, material_evidence: { state: "unavailable" } });
});

it("withholds material references for a cancelled request without reading its documents", async () => {
  const cancelled = { ...request, status: "cancelled" };
  rpc.mockResolvedValue(cancelled);
  expect(await read()).toEqual({ request: cancelled, material_evidence: { state: "unavailable" } });
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("rejects a material request response from another owner before reading more evidence", async () => {
  rpc.mockResolvedValue({ ...request, owner_id: otherId });
  await expect(read()).rejects.toThrow("Material evidence");
  expect(rpc).toHaveBeenCalledTimes(1);
});

it("rejects a document outside the selected material subject", async () => {
  rpc.mockImplementation(async (name: string) =>
    name === "read_context_request"
      ? request
      : name === "list_context_material_request_target"
        ? target
        : [{ ...document, subjectId: otherId }],
  );
  await expect(read()).rejects.toThrow("Material evidence");
});

it("rejects inconsistent source-version references instead of returning a guessed version", async () => {
  rpc.mockImplementation(async (name: string) =>
    name === "read_context_request"
      ? request
      : name === "list_context_material_request_target"
        ? target
        : [{ ...document, sourceVersionIds: [otherId] }],
  );
  await expect(read()).rejects.toThrow("Material evidence");
});

it("withholds the receipt when access is revoked during the evidence read", async () => {
  authorize.mockRejectedValueOnce(new Error("Access denied"));
  await expect(read()).rejects.toThrow("Access denied");
  expect(rpc).not.toHaveBeenCalled();
  authorize
    .mockResolvedValueOnce({ accountId: actor, ownerId: owner })
    .mockRejectedValueOnce(new Error("Access denied"));
  await expect(read()).rejects.toThrow("Access denied");
});

it("rejects a material snapshot that does not match the saved submission fingerprint", async () => {
  rpc.mockImplementation(async (name: string) =>
    name === "read_context_request"
      ? request
      : name === "list_context_material_request_target"
        ? target
        : [
            {
              ...document,
              text: JSON.stringify({ ...JSON.parse(document.text), contentHash: "b".repeat(64) }),
            },
          ],
  );
  await expect(read()).rejects.toThrow("Material evidence");
});
