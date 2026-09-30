import { beforeEach, expect, it, vi } from "vitest";
import { getContextModuleInput } from "../getContextModuleInput";
const { recording, rpc, targets } = vi.hoisted(() => ({
  recording: vi.fn(),
  rpc: vi.fn(),
  targets: vi.fn(),
}));
vi.mock("../getContextRecordingIsrc", () => ({ getContextRecordingIsrc: recording }));
vi.mock("../callContextRpc", () => ({ callContextRpc: rpc }));
vi.mock("../listContextRequestTargets", () => ({ listContextRequestTargets: targets }));
const owner = "00000000-0000-4000-8000-000000000001";
const request = "00000000-0000-4000-8000-000000000002";
const subjectId = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.clearAllMocks();
  recording.mockResolvedValue("USAT22103065");
  targets.mockResolvedValue([]);
});
it.each(["musicbrainz", "mlc_recording"])(
  "loads %s identifiers from the saved scoped recording",
  async module => {
    await expect(
      getContextModuleInput(owner, request, { module, subjectId }, "policy-v1"),
    ).resolves.toEqual({ isrc: "USAT22103065", collectionVersion: "policy-v1" });
    expect(recording).toHaveBeenCalledWith(owner, request, subjectId);
  },
);
it("resolves a Spotify release through the request-scoped database function", async () => {
  rpc.mockResolvedValue({ releaseId: "3vX9jU6Ix8t7XsAWLoZs10" });
  const result = await getContextModuleInput(
    owner,
    request,
    { module: "spotify_release", subjectId },
    "policy-v1",
  );
  expect(result).toEqual({ releaseId: "3vX9jU6Ix8t7XsAWLoZs10", collectionVersion: "policy-v1" });
  expect(rpc).toHaveBeenCalledWith("resolve_context_spotify_release", {
    p_owner: owner,
    p_request: request,
    p_subject: subjectId,
  });
});
it.each([
  {
    kind: "recording",
    fields: ["isrc"],
    identifier: "isrc",
    lookup: { kind: "recording", isrc: "USAT22103065" },
  },
  {
    kind: "recording",
    fields: ["spotify_id"],
    identifier: "spotify_id",
    lookup: { kind: "recording", spotifyId: "2zpWJxfuyxqCYhpsAqH7Uh" },
  },
  {
    kind: "artist",
    fields: ["spotify_id"],
    identifier: "spotify_id",
    lookup: { kind: "artist", spotifyId: "1QzqrU2lmiW9l1mSvliVoM" },
  },
])("prepares a verified $kind Songstats lookup from $identifier", async item => {
  targets.mockResolvedValue([
    {
      subjectId,
      kind: item.kind,
      identityConfirmed: true,
      availableFields: item.fields,
      reusableModules: [],
    },
  ]);
  rpc.mockResolvedValue(item.lookup);
  await expect(
    getContextModuleInput(owner, request, { module: "songstats", subjectId }, "policy-v1"),
  ).resolves.toEqual({ lookup: item.lookup, collectionVersion: "policy-v1" });
  expect(rpc).toHaveBeenCalledWith("resolve_context_songstats_lookup", {
    p_owner: owner,
    p_request: request,
    p_subject: subjectId,
    p_kind: item.kind,
    p_identifier: item.identifier,
  });
});
it("refuses missing, unconfirmed and unsupported Songstats subjects before resolving an ID", async () => {
  for (const target of [
    null,
    { kind: "recording", identityConfirmed: false, availableFields: ["isrc"] },
    { kind: "company", identityConfirmed: true, availableFields: ["spotify_id"] },
    { kind: "artist", identityConfirmed: true, availableFields: [] },
  ]) {
    targets.mockResolvedValue(target ? [{ subjectId, reusableModules: [], ...target }] : []);
    await expect(
      getContextModuleInput(owner, request, { module: "songstats", subjectId }, "v1"),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  }
});
it("rejects unsupported paths and invalid policy versions before database access", async () => {
  await expect(
    getContextModuleInput(owner, request, { module: "mlc_work", subjectId }, "v1"),
  ).rejects.toThrow();
  await expect(
    getContextModuleInput(owner, request, { module: "musicbrainz", subjectId }, ""),
  ).rejects.toThrow();
  expect(recording).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("propagates revoked recording access and rejects malformed release identity", async () => {
  recording.mockRejectedValue(new Error("revoked"));
  await expect(
    getContextModuleInput(owner, request, { module: "musicbrainz", subjectId }, "v1"),
  ).rejects.toThrow("revoked");
  rpc.mockResolvedValue({ releaseId: null });
  await expect(
    getContextModuleInput(owner, request, { module: "spotify_release", subjectId }, "v1"),
  ).rejects.toThrow();
});
