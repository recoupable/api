import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const review = "44444444-4444-4444-8444-444444444444";
const cases = [
  [
    { action: "list_release_cases", organization_id: owner },
    "list_context_release_cases",
    { p_actor: actor, p_owner: owner, p_after: null },
  ],
  [
    { action: "read_release_case", organization_id: owner, request_id: request },
    "read_context_release_case",
    { p_actor: actor, p_owner: owner, p_request: request },
  ],
  [
    {
      action: "review_release_case",
      organization_id: owner,
      request_id: request,
      fingerprint: "a".repeat(64),
      decision: "needs_changes",
      note: "Credit differs",
      idempotency_key: "review-1",
    },
    "review_context_release_case",
    {
      p_actor: actor,
      p_owner: owner,
      p_request: request,
      p_fingerprint: "a".repeat(64),
      p_decision: "needs_changes",
      p_note: "Credit differs",
      p_key: "review-1",
    },
  ],
  [
    { action: "read_release_case_review", organization_id: owner, review_id: review },
    "read_context_release_case_review",
    { p_actor: actor, p_owner: owner, p_review: review },
  ],
] as const;
describe("release operating cases", () => {
  it.each(cases)("shares scoped %j without collection", async (input, name, params) => {
    const rpc = vi.fn(async () => ({ contract_version: "release-case-v1" }));
    const dispatch = vi.fn();
    const authorize = vi.fn(async () => ({
      accountId: actor,
      ownerId: owner,
      organizationId: owner,
    }));
    expect(await processContextOperation(actor, input, { rpc, dispatch, authorize })).toEqual({
      contract_version: "release-case-v1",
    });
    expect(authorize).toHaveBeenCalledWith(actor, owner);
    expect(rpc).toHaveBeenCalledExactlyOnceWith(name, params);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("does not read or write on revoked access", async () => {
    const rpc = vi.fn();
    await expect(
      processContextOperation(actor, cases[2][0], {
        rpc,
        dispatch: vi.fn(),
        authorize: vi.fn(async () => {
          throw new Error("Access denied");
        }),
      }),
    ).rejects.toThrow("Access denied");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects fabricated snapshots, actors and unbound review decisions", () => {
    const valid = cases[2][0];
    for (const changes of [
      { account_id: actor },
      { snapshot: {} },
      { fingerprint: "" },
      { decision: "approve_distribution" },
      { note: "x".repeat(2001) },
    ])
      expect(contextOperationSchema.safeParse({ ...valid, ...changes }).success).toBe(false);
  });
});
