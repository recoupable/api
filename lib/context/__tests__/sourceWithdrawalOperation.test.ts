import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
// Isolate module initialization from hosted Supabase credentials; tests inject authorization.
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const source = "44444444-4444-4444-8444-444444444444";
const version = "55555555-5555-4555-8555-555555555555";
const input = {
  action: "withdraw_source",
  organization_id: owner,
  request_id: request,
  source_id: source,
};
const receipt = {
  contract_version: "context-source-withdrawal-v1",
  request_id: request,
  source_id: source,
  withdrawn_at: "2026-10-10T12:00:00+00:00",
  already_withdrawn: false,
  affected: { results: 1, documents: 1, request_ids: [request] },
};
describe("source withdrawal operation", () => {
  it("withdraws one recorded input through the actor-scoped RPC without collection", async () => {
    const rpc = vi.fn(async () => receipt);
    const dispatch = vi.fn();
    const authorize = vi.fn(async () => ({
      accountId: actor,
      ownerId: owner,
      organizationId: owner,
    }));
    expect(await processContextOperation(actor, input, { rpc, dispatch, authorize })).toEqual(
      receipt,
    );
    expect(authorize).toHaveBeenCalledWith(actor, owner);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("withdraw_context_request_source", {
      p_actor: actor,
      p_owner: owner,
      p_request: request,
      p_source: source,
      p_source_version: null,
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("uses the personal workspace when no organization is selected", async () => {
    const rpc = vi.fn(async () => receipt);
    const authorize = vi.fn(async () => ({
      accountId: actor,
      ownerId: actor,
      organizationId: null,
    }));
    const { organization_id: _omitted, ...personal } = input;
    await processContextOperation(actor, personal, { rpc, dispatch: vi.fn(), authorize });
    expect(authorize).toHaveBeenCalledWith(actor, undefined);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("withdraw_context_request_source", {
      p_actor: actor,
      p_owner: actor,
      p_request: request,
      p_source: source,
      p_source_version: null,
    });
  });
  it("withdraws by a manifest source version and returns the resolved source", async () => {
    const rpc = vi.fn(async () => receipt);
    const authorize = vi.fn(async () => ({
      accountId: actor,
      ownerId: owner,
      organizationId: owner,
    }));
    const { source_id: _omitted, ...byVersion } = input;
    expect(
      await processContextOperation(
        actor,
        { ...byVersion, source_version_id: version },
        { rpc, dispatch: vi.fn(), authorize },
      ),
    ).toEqual(receipt);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("withdraw_context_request_source", {
      p_actor: actor,
      p_owner: owner,
      p_request: request,
      p_source: null,
      p_source_version: version,
    });
  });
  it("requires exactly one source identifier", () => {
    const { source_id: _omitted, ...neither } = input;
    for (const value of [neither, { ...input, source_version_id: version }]) {
      const parsed = contextOperationSchema.safeParse(value);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]).toMatchObject({
        path: ["source_id"],
        message: "Provide exactly one of source_id or source_version_id",
      });
    }
  });
  it("passes an idempotent replay receipt through unchanged", async () => {
    const replay = { ...receipt, already_withdrawn: true };
    const rpc = vi.fn(async () => replay);
    const authorize = vi.fn(async () => ({
      accountId: actor,
      ownerId: owner,
      organizationId: owner,
    }));
    expect(
      await processContextOperation(actor, input, { rpc, dispatch: vi.fn(), authorize }),
    ).toEqual(replay);
  });
  it("does not withdraw on revoked access", async () => {
    const rpc = vi.fn();
    await expect(
      processContextOperation(actor, input, {
        rpc,
        dispatch: vi.fn(),
        authorize: vi.fn(async () => {
          throw new Error("Access denied");
        }),
      }),
    ).rejects.toThrow("Access denied");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects fabricated actors, missing requests and non-UUID sources", () => {
    expect(contextOperationSchema.safeParse(input).success).toBe(true);
    for (const changes of [
      { account_id: actor },
      { delete_original: true },
      { request_id: undefined },
      { source_id: "not-a-uuid" },
      { source_version_id: "not-a-uuid", source_id: undefined },
      { organization_id: "" },
    ]) {
      const parsed = contextOperationSchema.safeParse({ ...input, ...changes });
      expect(parsed.success).toBe(false);
      const key = Object.keys(changes)[0];
      const issue = parsed.error?.issues[0];
      if (key === "account_id" || key === "delete_original")
        expect(issue).toMatchObject({ code: "unrecognized_keys", keys: [key] });
      else expect(issue?.path).toEqual([key]);
    }
  });
});
