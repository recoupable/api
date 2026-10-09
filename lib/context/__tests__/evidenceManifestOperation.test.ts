import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const version = "44444444-4444-4444-8444-444444444444";
const input = { action: "list_evidence_versions", request_id: request, organization_id: owner };
const item = {
  source_version_id: version,
  source_id: actor,
  source_kind: "customer",
  fingerprint: "a".repeat(64),
  retrieved_at: "2026-10-09T18:00:00+00:00",
  evidence_kinds: ["customer_assertion"],
  is_current: true,
};
const page = {
  owner_id: owner,
  request_id: request,
  versions: [item],
  has_more: false,
  next_id: null,
};
function setup(value: unknown = page) {
  return {
    rpc: vi.fn(async (_name: string, _params: Record<string, unknown>) => value),
    dispatch: vi.fn(),
    authorize: vi.fn(async () => ({ accountId: actor, ownerId: owner, organizationId: owner })),
  };
}
it("reads retained evidence using the authenticated actor without dispatch", async () => {
  const deps = setup();
  expect(await processContextOperation(actor, input, deps)).toEqual(page);
  expect(deps.authorize).toHaveBeenCalledExactlyOnceWith(actor, owner);
  expect(deps.rpc).toHaveBeenCalledExactlyOnceWith("list_context_request_evidence_versions", {
    p_actor: actor,
    p_owner: owner,
    p_request: request,
    p_after: null,
  });
  expect(deps.dispatch).not.toHaveBeenCalled();
});
it("returns an empty final page", async () => {
  const value = { ...page, versions: [] };
  expect(await processContextOperation(actor, input, setup(value))).toEqual(value);
});
it("denies revoked access before reading", async () => {
  const deps = setup();
  deps.authorize.mockRejectedValueOnce(new Error("Access denied"));
  await expect(processContextOperation(actor, input, deps)).rejects.toThrow("Access denied");
  expect(deps.rpc).not.toHaveBeenCalled();
});
it.each(["account_id", "actor_id", "owner_id", "rights_verified"])(
  "rejects injected %s before authorization",
  async key => {
    const deps = setup();
    await expect(
      processContextOperation(actor, { ...input, [key]: owner }, deps),
    ).rejects.toThrow();
    expect(deps.authorize).not.toHaveBeenCalled();
  },
);
it.each([
  { ...page, owner_id: actor },
  { ...page, request_id: actor },
  { ...page, versions: [item, item] },
  { ...page, versions: Array(51).fill(item) },
  { ...page, versions: [{ ...item, evidence_kinds: ["creative_proposal"] }] },
  { ...page, versions: [{ ...item, evidence_kinds: [] }] },
  { ...page, versions: [{ ...item, evidence_kinds: ["observation", "observation"] }] },
  { ...page, versions: [{ ...item, retrieved_at: "yesterday" }] },
  { ...page, versions: [{ ...item, fingerprint: "z".repeat(64) }] },
  { ...page, versions: [{ ...item, fingerprint: "A".repeat(64) }] },
  { ...page, versions: [{ ...item, content: "private payload" }] },
  { ...page, versions: [{ ...item, rights_verified: true }] },
  { ...page, next_id: version },
  { ...page, has_more: true, next_id: version },
  { ...page, has_more: true, next_id: null },
])("rejects unsafe or inconsistent output %#", async value => {
  await expect(processContextOperation(actor, input, setup(value))).rejects.toThrow();
});
it("passes a valid cursor and checks the full page's last version", async () => {
  const versions = Array.from({ length: 50 }, (_, i) => ({
    ...item,
    source_version_id: `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`,
  }));
  const value = { ...page, versions, has_more: true, next_id: versions[49].source_version_id };
  const deps = setup(value);
  expect(await processContextOperation(actor, { ...input, after_id: version }, deps)).toEqual(
    value,
  );
  expect(deps.rpc.mock.calls[0][1].p_after).toBe(version);
});
it("rejects a returned version equal to the incoming cursor", async () => {
  await expect(
    processContextOperation(actor, { ...input, after_id: version }, setup()),
  ).rejects.toThrow();
});
