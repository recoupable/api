import { describe, expect, it, vi } from "vitest";
import { fetchSpotifyContext } from "../fetchSpotifyContext";
import { runContextRequest } from "../runContextRequest";

const id = "2ay96C6SLNv9urvXKD3ecB";
const track = {
  id,
  name: "Song",
  duration_ms: 180000,
  external_ids: { isrc: "USABC2600001" },
  artists: [{ id: "1234567890123456789012", name: "Artist" }],
  album: {
    id: "abcdefghijklmnopqrstuv",
    name: "Release",
    images: [{ url: "https://i.scdn.co/image/art" }],
    release_date: "2026-09-01",
    release_date_precision: "day",
  },
  preview_url: null,
};

describe("Spotify context extraction", () => {
  it("preserves exact recording, release, artist order and unknown audio", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(track)));
    const result = await fetchSpotifyContext(id, "token", fetcher);
    expect(result.trackId).toBe(id);
    expect(result.isrc).toBe("USABC2600001");
    expect(result.artists[0].id).toBe(track.artists[0].id);
    expect(result.previewUrl).toBeNull();
    expect(result.raw).toEqual(track);
  });
  it("rejects wrong recording instead of silently accepting relinking", async () => {
    await expect(
      fetchSpotifyContext(
        id,
        "token",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...track, id: "other" }))),
      ),
    ).rejects.toThrow();
  });
  it("does not invent ISRC when provider metadata is incomplete", async () => {
    await expect(
      fetchSpotifyContext(
        id,
        "token",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...track, external_ids: {} }))),
      ),
    ).rejects.toThrow();
  });
  it("fails on provider errors", async () => {
    await expect(
      fetchSpotifyContext(
        id,
        "token",
        vi.fn().mockResolvedValue(new Response("", { status: 429 })),
      ),
    ).rejects.toThrow("429");
  });
});

describe("persistent request orchestration", () => {
  const request = {
    id: "request",
    owner_id: "owner",
    created_by: "actor",
    input: { url: `https://open.spotify.com/track/${id}`, topics: ["release_metadata"] },
    status: "queued",
  };
  const context = { trackId: id };
  function setup() {
    const rpc = vi.fn(async (name: string) =>
      name === "read_context_request"
        ? request
        : name === "claim_context_request"
          ? true
          : { ...request, status: "completed" },
    );
    return { rpc, authorize: vi.fn(async () => undefined), extract: vi.fn(async () => context) };
  }
  it("persists fetched results and rechecks access before committing", async () => {
    const deps = setup();
    await runContextRequest("actor", "owner", "request", deps as never);
    expect(deps.authorize).toHaveBeenCalledTimes(2);
    expect(deps.rpc).toHaveBeenCalledWith(
      "commit_spotify_context",
      expect.objectContaining({ p_request: "request", p_payload: context }),
    );
  });
  it("does not call providers for completed or already claimed work", async () => {
    const deps = setup();
    deps.rpc.mockImplementation(async name =>
      name === "read_context_request" ? { ...request, status: "completed" } : (false as never),
    );
    await runContextRequest("actor", "owner", "request", deps as never);
    expect(deps.extract).not.toHaveBeenCalled();
  });
  it("records failure rather than leaving an apparently successful job", async () => {
    const deps = setup();
    deps.extract.mockRejectedValue(new Error("provider unavailable"));
    await expect(runContextRequest("actor", "owner", "request", deps as never)).rejects.toThrow(
      "provider unavailable",
    );
    expect(deps.rpc).toHaveBeenCalledWith(
      "fail_context_request",
      expect.objectContaining({ p_request: "request" }),
    );
  });
  it("revoked access prevents accepted writes", async () => {
    const deps = setup();
    deps.authorize.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("revoked"));
    await expect(runContextRequest("actor", "owner", "request", deps as never)).rejects.toThrow(
      "revoked",
    );
    expect(deps.rpc.mock.calls.some(([name]) => name === "commit_spotify_context")).toBe(false);
  });
});
