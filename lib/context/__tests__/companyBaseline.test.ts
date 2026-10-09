import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import { baseline } from "./companyBaselineFixture";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const cursor = "33333333-3333-4333-8333-333333333333";
const input = { action: "read_company_baseline", organization_id: owner };

function dependencies(result: unknown = baseline) {
  return {
    rpc: vi.fn(async () => result),
    dispatch: vi.fn(),
    dispatchRelease: vi.fn(),
    dispatchReleaseTracks: vi.fn(),
    authorize: vi.fn(async () => ({ accountId: actor, ownerId: owner, organizationId: owner })),
  };
}
describe("company baseline", () => {
  it("returns existing scoped records without dispatching collection", async () => {
    const deps = dependencies();
    expect(await processContextOperation(actor, input, deps)).toEqual(baseline);
    expect(deps.authorize).toHaveBeenCalledWith(actor, owner);
    expect(deps.rpc).toHaveBeenCalledExactlyOnceWith("read_context_company_baseline", {
      p_actor: actor,
      p_org: owner,
      p_after_artist: null,
      p_after_professional: null,
      p_after_source: null,
    });
    expect(deps.dispatch).not.toHaveBeenCalled();
    expect(deps.dispatchRelease).not.toHaveBeenCalled();
    expect(deps.dispatchReleaseTracks).not.toHaveBeenCalled();
  });
  it("rejects an authorization result for a different owner before reading", async () => {
    const deps = dependencies();
    deps.authorize.mockResolvedValue({ accountId: actor, ownerId: actor, organizationId: actor });
    await expect(processContextOperation(actor, input, deps)).rejects.toThrow("scope mismatch");
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it("forwards independent cursors", async () => {
    const deps = dependencies();
    await processContextOperation(
      actor,
      { ...input, after_artist_id: cursor, after_source_id: actor },
      deps,
    );
    expect(deps.rpc).toHaveBeenCalledWith("read_context_company_baseline", {
      p_actor: actor,
      p_org: owner,
      p_after_artist: cursor,
      p_after_professional: null,
      p_after_source: actor,
    });
  });
  it("denies before storage when membership is revoked", async () => {
    const deps = dependencies();
    deps.authorize.mockRejectedValue(new Error("Access denied"));
    await expect(processContextOperation(actor, input, deps)).rejects.toThrow("Access denied");
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { action: "read_company_baseline" },
    { ...input, account_id: actor },
    { ...input, after_source_id: "invalid" },
    { ...input, collect: true },
  ])("rejects invalid or actor-supplied input %j", value => {
    expect(contextOperationSchema.safeParse(value).success).toBe(false);
  });
  it.each([
    null,
    { ...baseline, organization_id: actor },
    { ...baseline, coverage: "complete" },
    {
      ...baseline,
      sources: {
        items: [
          {
            source_id: cursor,
            kind: "customer",
            created_at: baseline.read_at,
            retained_version_count: -1,
          },
        ],
        next_id: null,
      },
    },
    { ...baseline, sources: { items: [], next_id: null, raw_document: "private" } },
  ])("rejects malformed or wrong-owner storage output %j", async result => {
    const deps = dependencies(result);
    await expect(processContextOperation(actor, input, deps)).rejects.toThrow();
    expect(deps.rpc).toHaveBeenCalledTimes(1);
  });
});
