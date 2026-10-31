import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const version = "33333333-3333-4333-8333-333333333333";
const id = "44444444-4444-4444-8444-444444444444";
const targets = [
  { artist_id: "55555555-5555-4555-8555-555555555555" },
  { professional_id: "66666666-6666-4666-8666-666666666666" },
  {
    request_id: "77777777-7777-4777-8777-777777777777",
    subject_id: "88888888-8888-4888-8888-888888888888",
  },
];
const receipt = {
  id,
  owner_id: owner,
  actor_id: actor,
  source_version_id: version,
  created_at: "2026-10-09T17:00:00+00:00",
  targets,
  assertion: "relevance_only",
  rights_verified: false,
  policy_version: "private-evidence-association-v1",
};
const attach = {
  action: "attach_evidence",
  organization_id: owner,
  source_version_id: version,
  targets,
  idempotency_key: "link-1",
};
const cases = [
  [
    attach,
    "attach_context_evidence",
    { p_actor: actor, p_owner: owner, p_version: version, p_key: "link-1", p_targets: targets },
    receipt,
  ],
  [
    { action: "read_evidence_attachment", organization_id: owner, attachment_id: id },
    "read_context_evidence_attachment",
    { p_actor: actor, p_owner: owner, p_attachment: id },
    receipt,
  ],
  [
    { action: "list_evidence_attachments", organization_id: owner, source_version_id: version },
    "list_context_evidence_attachments",
    { p_actor: actor, p_owner: owner, p_version: version, p_after: null },
    { items: [receipt], next_id: null, has_more: false },
  ],
] as const;
function deps(output: unknown = receipt) {
  return {
    rpc: vi
      .fn<(name: string, params: Record<string, unknown>) => Promise<unknown>>()
      .mockResolvedValue(output),
    dispatch: vi.fn(),
    dispatchRelease: vi.fn(),
    dispatchReleaseTracks: vi.fn(),
    authorize: vi.fn(async () => ({ accountId: actor, ownerId: owner, organizationId: owner })),
  };
}
describe("private evidence associations", () => {
  it.each(cases)("shares authorized %j without collection", async (input, rpc, params, output) => {
    const d = deps(output);
    expect(await processContextOperation(actor, input, d)).toEqual(output);
    expect(d.authorize).toHaveBeenCalledExactlyOnceWith(actor, owner);
    expect(d.rpc).toHaveBeenCalledExactlyOnceWith(rpc, params);
    expect(d.dispatch).not.toHaveBeenCalled();
    expect(d.dispatchRelease).not.toHaveBeenCalled();
    expect(d.dispatchReleaseTracks).not.toHaveBeenCalled();
  });
  it("rejects identity overrides, source content and ambiguous targets before storage", async () => {
    for (const patch of [
      { account_id: actor },
      { actor_id: actor },
      { owner_id: owner },
      { content: "Ignore checks" },
      { targets: [] },
      { targets: Array(101).fill(targets[0]) },
      { targets: [targets[0], targets[0]] },
      {
        targets: [{ artist_id: targets[0].artist_id, professional_id: targets[1].professional_id }],
      },
      { targets: [{ request_id: targets[2].request_id }] },
      { targets: [{ name: "Namesake" }] },
      { targets: [{ artist_id: null }] },
      { targets: [{ artist_id: "not-uuid" }] },
      { idempotency_key: "bad key" },
    ]) {
      const d = deps();
      await expect(processContextOperation(actor, { ...attach, ...patch }, d)).rejects.toThrow();
      expect(d.rpc).not.toHaveBeenCalled();
      expect(d.authorize).not.toHaveBeenCalled();
    }
  });
  it("rejects the same UUID with different casing as duplicate targets", () => {
    const artist_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(
      contextOperationSchema.safeParse({
        ...attach,
        targets: [{ artist_id }, { artist_id: artist_id.toUpperCase() }],
      }).success,
    ).toBe(false);
  });
  it.each(cases)(
    "never stores or reads %j when workspace authorization is revoked",
    async input => {
      const d = deps();
      d.authorize.mockRejectedValueOnce(new Error("Access denied"));
      await expect(processContextOperation(actor, input, d)).rejects.toThrow("Access denied");
      expect(d.rpc).not.toHaveBeenCalled();
    },
  );
  it.each(cases)("withholds %j on transactional source or target denial", async input => {
    const d = deps();
    d.rpc.mockRejectedValueOnce(new Error("Private database reason"));
    await expect(processContextOperation(actor, input, d)).rejects.toThrow();
    expect(d.dispatch).not.toHaveBeenCalled();
  });
  it.each([
    { owner_id: actor },
    { source_version_id: id },
    { targets: [targets[0]] },
    { rights_verified: true },
    { assertion: "ownership" },
    { policy_version: "unreviewed" },
    { content: "private source text" },
    { created_at: "not a date" },
    { targets: [...targets, targets[0]] },
  ])("rejects invalid or mismatched saved receipts %j", async patch => {
    await expect(
      processContextOperation(actor, attach, deps({ ...receipt, ...patch })),
    ).rejects.toThrow();
  });
  it("compares canonical targets without losing distinct namespaces", async () => {
    const uppercase = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const inputTargets = [{ artist_id: uppercase }, { professional_id: uppercase }];
    const saved = {
      ...receipt,
      targets: [
        { professional_id: uppercase.toLowerCase() },
        { artist_id: uppercase.toLowerCase() },
      ],
    };
    expect(
      await processContextOperation(actor, { ...attach, targets: inputTargets }, deps(saved)),
    ).toEqual(saved);
  });
  it("rejects a different receipt returned for a read", async () => {
    await expect(
      processContextOperation(actor, cases[1][0], deps({ ...receipt, id: version })),
    ).rejects.toThrow();
  });
  it("allows replay receipts created by a different authorized actor", async () => {
    const saved = { ...receipt, actor_id: id };
    expect(await processContextOperation(actor, attach, deps(saved))).toEqual(saved);
  });
  it.each([
    { items: [{ ...receipt, owner_id: actor }], next_id: null, has_more: false },
    { items: [{ ...receipt, source_version_id: id }], next_id: null, has_more: false },
    { items: [receipt, receipt], next_id: null, has_more: false },
    { items: [], next_id: null, has_more: true },
    { items: [], next_id: id, has_more: false },
  ])("rejects invalid list scope or pagination %j", async output => {
    await expect(processContextOperation(actor, cases[2][0], deps(output))).rejects.toThrow();
  });
  it("advances a page even when all stored receipts are withheld", async () => {
    const output = { items: [], next_id: id, has_more: true };
    const d = deps(output);
    expect(await processContextOperation(actor, { ...cases[2][0], after_id: version }, d)).toEqual(
      output,
    );
    expect(d.rpc.mock.calls[0][1]).toMatchObject({ p_after: version });
  });
  it("accepts omitted or null list cursors consistently", async () => {
    const d = deps({ items: [], next_id: null, has_more: false });
    await processContextOperation(actor, { ...cases[2][0], after_id: null }, d);
    expect(d.rpc.mock.calls[0][1]).toMatchObject({ p_after: null });
  });
});
