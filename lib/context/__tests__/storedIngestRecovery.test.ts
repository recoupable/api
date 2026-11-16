import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runContextStep } from "@/app/workflows/context/runContextStep";

const { rpc, authorize, token } = vi.hoisted(() => ({
  rpc: vi.fn(),
  authorize: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: rpc }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("@/lib/spotify/generateAccessToken", () => ({ default: token }));

const actor = "actor";
const owner = "workspace";
const id = "2ay96C6SLNv9urvXKD3ecB";
const request = {
  id: "request",
  owner_id: owner,
  created_by: actor,
  status: "queued",
  input: { url: `https://open.spotify.com/track/${id}?si=fixture` },
};
const track = {
  id,
  name: "Synthetic track",
  duration_ms: 180000,
  external_ids: { isrc: "USABC2600001" },
  artists: [{ id: "1234567890123456789012", name: "Synthetic artist" }],
  album: { id: "abcdefghijklmnopqrstuv", name: "Synthetic release", images: [] },
};
const fetcher = vi.fn();
const run = () => runContextStep(actor, owner, request.id);
const calls = () => rpc.mock.calls.map(([name]) => name);
const params = (name: string) => rpc.mock.calls.find(([called]) => called === name)![1];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetcher);
  authorize.mockResolvedValue({ ownerId: owner });
  token.mockResolvedValue({ access_token: "synthetic-token" });
  fetcher.mockResolvedValue(new Response(JSON.stringify(track)));
  rpc.mockImplementation(async (name: string) => {
    if (name === "read_context_request") return request;
    if (name === "claim_context_request") return true;
    if (name === "commit_spotify_context") return { ...request, status: "completed" };
    if (name === "fail_context_request") return false;
    throw new Error(`Unexpected mocked RPC: ${name}`);
  });
});
afterEach(() => vi.unstubAllGlobals());

it("runs the actual stored-request adapter and rechecks scope before commit", async () => {
  await expect(run()).resolves.toMatchObject({ status: "completed" });
  expect(calls()).toEqual([
    "read_context_request",
    "claim_context_request",
    "commit_spotify_context",
  ]);
  expect(authorize.mock.calls).toEqual([
    [actor, owner],
    [actor, owner],
  ]);
  expect(fetcher).toHaveBeenCalledWith(
    `https://api.spotify.com/v1/tracks/${id}`,
    expect.any(Object),
  );
  expect(params("commit_spotify_context")).toMatchObject({
    p_owner: owner,
    p_request: request.id,
    p_token: params("claim_context_request").p_token,
    p_payload: { trackId: id, isrc: track.external_ids.isrc },
  });
});

it("persists authored provider guidance and rethrows despite a false failure acknowledgment", async () => {
  fetcher.mockResolvedValue(new Response("CANARY-provider-body", { status: 429 }));
  await expect(run()).rejects.toMatchObject({ code: "provider_outage" });
  expect(calls()).toEqual([
    "read_context_request",
    "claim_context_request",
    "fail_context_request",
  ]);
  expect(params("fail_context_request")).toMatchObject({
    p_owner: owner,
    p_token: params("claim_context_request").p_token,
    p_error: expect.stringMatching(/^provider_outage: /),
  });
  expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/CANARY|synthetic-token/);
});

it("keeps missing provider authentication unknown before any fetch", async () => {
  token.mockResolvedValue({});
  await expect(run()).rejects.toThrow("Spotify authentication unavailable");
  expect(fetcher).not.toHaveBeenCalled();
  expect(params("fail_context_request").p_error).toMatch(/^unknown: /);
  expect(calls()).not.toContain("commit_spotify_context");
});

it("denies access before reading, claiming, or requesting a token", async () => {
  const denial = new Error("CANARY-denied");
  authorize.mockRejectedValue(denial);
  await expect(run()).rejects.toBe(denial);
  expect(rpc).not.toHaveBeenCalled();
  expect(token).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it("withholds commit if access is revoked after extraction", async () => {
  const denial = new Error("CANARY-revoked");
  authorize.mockResolvedValueOnce({ ownerId: owner }).mockRejectedValueOnce(denial);
  await expect(run()).rejects.toBe(denial);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(calls()).not.toContain("commit_spotify_context");
  expect(params("fail_context_request").p_error).toMatch(/^unknown: /);
  expect(JSON.stringify(rpc.mock.calls)).not.toContain("CANARY");
});

it("does not extract when another delivery owns the claim", async () => {
  rpc.mockImplementation(async (name: string) =>
    name === "read_context_request" ? request : false,
  );
  await expect(run()).resolves.toEqual(request);
  expect(calls()).toEqual(["read_context_request", "claim_context_request"]);
  expect(token).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it.each(["completed", "partial", "cancelled"])(
  "skips provider work for terminal %s",
  async status => {
    rpc.mockResolvedValue({ ...request, status });
    await expect(run()).resolves.toMatchObject({ status });
    expect(calls()).toEqual(["read_context_request"]);
    expect(token).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  },
);
