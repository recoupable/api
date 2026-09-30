import { afterEach, expect, it, vi } from "vitest";
import { runReleaseVerification } from "../runReleaseVerification";
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));

const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const subjectId = "00000000-0000-4000-8000-000000000004";
const target = {
  subjectId,
  kind: "release",
  identityConfirmed: false,
  availableFields: ["spotify_id"],
  reusableModules: [],
};
afterEach(() => vi.unstubAllEnvs());

it("denies release collection while the server switch is off, before database or provider access", async () => {
  const rpc = vi.fn();
  const record = vi.fn();
  await expect(runReleaseVerification(actor, owner, requestId, { rpc, record })).rejects.toThrow(
    "not enabled",
  );
  expect(rpc).not.toHaveBeenCalled();
  expect(record).not.toHaveBeenCalled();
});

it("builds one request-bound, server-permitted release node and rechecks scope", async () => {
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
  const authorize = vi.fn(async () => undefined);
  const rpc = vi.fn(async () => target);
  const dispatch = vi.fn();
  const record = vi.fn(async (input, deps) => {
    expect(input.plan).toMatchObject([
      {
        key: `${subjectId}:spotify_release`,
        state: "ready_for_dispatch",
        subjectId,
        module: "spotify_release",
      },
    ]);
    await deps.authorizeExecution(actor, owner, requestId);
    await deps.authorizeNode(input.plan[0]);
    return [];
  });
  const result = await runReleaseVerification(actor, owner, requestId, {
    authorize,
    rpc,
    record,
    dispatch,
  });
  expect(result.executionId).toMatch(/^[0-9a-f-]{36}$/);
  expect(result.outcomes).toEqual([]);
  expect(rpc).toHaveBeenCalledWith("list_context_release_request_target", {
    p_owner: owner,
    p_request: requestId,
  });
  expect(authorize).toHaveBeenCalledTimes(3);
  expect(dispatch).not.toHaveBeenCalled();
});

it("denies a changed release target before claiming a provider node", async () => {
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
  const rpc = vi
    .fn()
    .mockResolvedValueOnce(target)
    .mockResolvedValueOnce({ ...target, subjectId: "00000000-0000-4000-8000-000000000005" });
  const record = vi.fn(async (input, deps) => {
    await deps.authorizeExecution(actor, owner, requestId);
    return input.plan;
  });
  await expect(
    runReleaseVerification(actor, owner, requestId, {
      authorize: async () => undefined,
      rpc,
      record,
    }),
  ).rejects.toThrow("Release target changed");
});

it("rechecks the server switch after planning and before execution", async () => {
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
  const record = vi.fn(async (_input, deps) => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "false");
    await deps.authorizeExecution(actor, owner, requestId);
    return [];
  });
  await expect(
    runReleaseVerification(actor, owner, requestId, {
      authorize: async () => undefined,
      rpc: async () => target,
      record,
    }),
  ).rejects.toThrow("not enabled");
});
