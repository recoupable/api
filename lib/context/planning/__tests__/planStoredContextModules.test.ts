import { beforeEach, expect, it, vi } from "vitest";
import { planStoredContextModules } from "../planStoredContextModules";

const { authorize, rpc, targets } = vi.hoisted(() => ({
  authorize: vi.fn(),
  rpc: vi.fn(),
  targets: vi.fn(),
}));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: rpc }));
vi.mock("@/lib/supabase/context_requests/listContextRequestTargets", () => ({
  listContextRequestTargets: targets,
}));

const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const recording = "00000000-0000-4000-8000-000000000004";
const release = "00000000-0000-4000-8000-000000000005";
const artist = "00000000-0000-4000-8000-000000000006";

beforeEach(() => {
  vi.clearAllMocks();
  authorize.mockResolvedValue({ ownerId: owner });
  rpc.mockResolvedValue({
    id: requestId,
    owner_id: owner,
    status: "completed",
    input: { url: "https://open.spotify.com/track/2zpWJxfuyxqCYhpsAqH7Uh" },
  });
  targets.mockResolvedValue([
    {
      subjectId: recording,
      kind: "recording",
      identityConfirmed: true,
      availableFields: ["isrc", "spotify_id"],
      reusableModules: [],
    },
    {
      subjectId: release,
      kind: "release",
      identityConfirmed: true,
      availableFields: ["spotify_id"],
      reusableModules: [],
    },
    {
      subjectId: artist,
      kind: "artist",
      identityConfirmed: true,
      availableFields: ["spotify_id"],
      reusableModules: [],
    },
  ]);
});

it("plans relevant Spotify modules from authorized saved evidence without permitting dispatch", async () => {
  const result = await planStoredContextModules(actor, owner, requestId);
  expect(authorize).toHaveBeenCalledWith(actor, owner);
  expect(rpc).toHaveBeenCalledWith("read_context_request", {
    p_owner: owner,
    p_request: requestId,
  });
  expect(targets).toHaveBeenCalledWith(owner, requestId);
  expect(result.entry).toBe("song");
  expect(result.plan.map(node => node.module)).toEqual([
    "musicbrainz",
    "mlc_recording",
    "songstats",
    "spotify_release",
    "songstats",
    "saved_socials",
  ]);
  expect(
    result.plan.every(node => node.state === "blocked" && node.executionStarted === false),
  ).toBe(true);
});

it("rejects another workspace before reading targets", async () => {
  authorize.mockRejectedValue(new Error("Access denied"));
  await expect(planStoredContextModules(actor, owner, requestId)).rejects.toThrow("Access denied");
  expect(rpc).not.toHaveBeenCalled();
  expect(targets).not.toHaveBeenCalled();
});

it("rejects an unready or unsupported saved request", async () => {
  rpc.mockResolvedValueOnce({
    id: requestId,
    owner_id: owner,
    status: "running",
    input: { url: "https://open.spotify.com/track/2zpWJxfuyxqCYhpsAqH7Uh" },
  });
  await expect(planStoredContextModules(actor, owner, requestId)).rejects.toThrow("not ready");
  rpc.mockResolvedValueOnce({
    id: requestId,
    owner_id: owner,
    status: "completed",
    input: { kind: "artist" },
  });
  await expect(planStoredContextModules(actor, owner, requestId)).rejects.toThrow(
    "Unsupported saved context entry",
  );
  expect(targets).not.toHaveBeenCalled();
});

it("shows a verified catalog as blocked until server policy permits collection", async () => {
  rpc.mockResolvedValue({
    id: requestId,
    owner_id: owner,
    status: "partial",
    input: { kind: "catalog", catalogId: "00000000-0000-4000-8000-000000000007" },
  });
  targets.mockResolvedValue([
    {
      subjectId: recording,
      kind: "catalog",
      identityConfirmed: true,
      availableFields: ["catalog_account_link"],
      reusableModules: [],
    },
  ]);
  const result = await planStoredContextModules(actor, owner, requestId);
  expect(result.entry).toBe("catalog");
  expect(result.plan).toMatchObject([
    {
      module: "catalog_valuation",
      state: "blocked",
      reasons: expect.arrayContaining(["Server collection policy has not permitted this module"]),
    },
  ]);
  expect(result.collectionPermitted).toBe(false);
});
