import { expect, it, vi } from "vitest";
import { dispatchPlannedContextModule } from "../dispatchPlannedContextModule";
const subjectId = "00000000-0000-4000-8000-000000000001";
const node = (module = "musicbrainz", state = "ready_for_dispatch") => ({
  key: `${subjectId}:${module}`,
  subjectId,
  module,
  state,
});
function deps() {
  return {
    authorize: vi.fn(async () => undefined),
    authorizeProvider: vi.fn(async () => undefined),
    loadInput: vi.fn(
      async (): Promise<unknown> => ({ isrc: "USAT22103065", collectionVersion: "v1" }),
    ),
    resolveRecording: vi.fn(async () => "USAT22103065"),
    acquireMusicBrainzPermit: vi.fn(async () => undefined),
    getMlcToken: vi.fn(async () => "secret"),
    getSpotifyToken: vi.fn(async () => "secret"),
    fetcher: vi.fn<typeof fetch>(async () => new Response(null, { status: 404 })),
    rpc: vi.fn(
      async (name: string): Promise<unknown> =>
        name === "claim_context_enrichment"
          ? { state: "claimed", attemptId: "a" }
          : { state: "saved" },
    ),
  };
}
it("dispatches a verified MusicBrainz recording through the existing persisted collector", async () => {
  const d = deps();
  await dispatchPlannedContextModule("a", "o", "r", node(), d);
  expect(d.authorizeProvider).toHaveBeenCalledWith("a", "o", "r", "musicbrainz");
  expect(d.acquireMusicBrainzPermit).toHaveBeenCalledOnce();
  expect(d.rpc).toHaveBeenCalledWith("complete_context_enrichment", expect.anything());
});
it("reuses without obtaining provider permission or credentials", async () => {
  const d = deps();
  d.rpc.mockResolvedValue({ state: "reused" });
  await dispatchPlannedContextModule("a", "o", "r", node("mlc_recording", "reuse_candidate"), d);
  expect(d.authorizeProvider).not.toHaveBeenCalled();
  expect(d.getMlcToken).not.toHaveBeenCalled();
  expect(d.fetcher).not.toHaveBeenCalled();
});
it("blocks a reuse miss when fresh collection is not permitted", async () => {
  const d = deps();
  d.authorizeProvider.mockRejectedValue(new Error("collection not approved"));
  await expect(
    dispatchPlannedContextModule("a", "o", "r", node("mlc_recording", "reuse_candidate"), d),
  ).rejects.toThrow("collection not approved");
  expect(d.getMlcToken).not.toHaveBeenCalled();
  expect(d.fetcher).not.toHaveBeenCalled();
});
it("rejects blocked, unsupported and inconsistent plan nodes before loading input", async () => {
  for (const input of [
    node("musicbrainz", "blocked"),
    node("mlc_work"),
    { ...node(), key: "wrong" },
  ]) {
    const d = deps();
    await expect(dispatchPlannedContextModule("a", "o", "r", input, d)).rejects.toThrow();
    expect(d.loadInput).not.toHaveBeenCalled();
    expect(d.rpc).not.toHaveBeenCalled();
  }
});
it("checks workspace access before loading server-side module input", async () => {
  const d = deps();
  d.authorize.mockRejectedValue(new Error("denied"));
  await expect(dispatchPlannedContextModule("a", "o", "r", node(), d)).rejects.toThrow("denied");
  expect(d.loadInput).not.toHaveBeenCalled();
});

it("checks Spotify release identity and policy before obtaining its token", async () => {
  const d = deps();
  const releaseId = "3vX9jU6Ix8t7XsAWLoZs10";
  d.loadInput.mockResolvedValue({ releaseId, collectionVersion: "v1" });
  d.rpc.mockImplementation(async name =>
    name === "resolve_context_spotify_release"
      ? { releaseId }
      : name === "claim_context_enrichment"
        ? { state: "claimed", attemptId: "a" }
        : { state: "saved" },
  );
  d.authorizeProvider.mockRejectedValue(new Error("not approved"));
  await expect(
    dispatchPlannedContextModule("a", "o", "r", node("spotify_release"), d),
  ).rejects.toThrow("not approved");
  expect(d.getSpotifyToken).not.toHaveBeenCalled();
  expect(d.fetcher).not.toHaveBeenCalled();
});
it("connects planner, scheduler, dispatcher and collector with explicit fixture storage", async () => {
  const { planContextModules } = await import("../planContextModules");
  const { runPlannedContextModules } = await import("../runPlannedContextModules");
  const d = deps();
  const plan = planContextModules({
    entry: "song",
    targets: [
      {
        subjectId,
        kind: "recording",
        identityConfirmed: true,
        availableFields: ["isrc"],
        reusableModules: [],
      },
    ],
    requested: [{ subjectId, module: "musicbrainz" }],
    permittedModules: ["musicbrainz"],
  });
  const persistOutcome = vi.fn(async () => undefined);
  const result = await runPlannedContextModules(plan, {
    authorize: d.authorize,
    dispatch: n => dispatchPlannedContextModule("a", "o", "r", n, d),
    persistOutcome,
  });
  expect(result[0].status).toBe("saved");
  expect(d.rpc).toHaveBeenCalledWith("complete_context_enrichment", expect.anything());
  expect(persistOutcome).toHaveBeenCalledWith(expect.objectContaining({ status: "saved" }));
});
