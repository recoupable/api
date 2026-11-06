import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { ContextIngestFailure } from "../ContextIngestFailure";
import { classifyContextIngestFailure } from "../classifyContextIngestFailure";
import { describeContextIngestFailure } from "../describeContextIngestFailure";
import { fetchSpotifyContext } from "../fetchSpotifyContext";
import { parseContextUrl } from "../parseContextUrl";
import { processContextOperation } from "../processContextOperation";
import { runContextRequest } from "../runContextRequest";
import { contextIngestSchema } from "../schema";
import { validateContextOperationBody } from "../validateContextOperationBody";

vi.mock("../authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async (id: string) => ({
    accountId: id,
    ownerId: id,
    organizationId: null,
  })),
}));

const trackId = "2ay96C6SLNv9urvXKD3ecB";
const canonical = `https://open.spotify.com/track/${trackId}`;
const actor = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const track = {
  id: trackId,
  name: "Song",
  duration_ms: 180000,
  external_ids: { isrc: "USABC2600001" },
  artists: [{ id: "1234567890123456789012", name: "Artist" }],
  album: {
    id: "abcdefghijklmnopqrstuv",
    name: "Release",
    album_type: "single",
    images: [{ url: "https://i.scdn.co/image/art" }],
    release_date: "2026-09-01",
    release_date_precision: "day",
  },
  preview_url: null,
};

describe("submitted track URL variations", () => {
  it.each([
    `${canonical}?si=abc123`,
    `${canonical}/`,
    `https://open.spotify.com/intl-de/track/${trackId}?si=xyz&utm_source=share`,
    `https://open.spotify.com/intl-pt/track/${trackId}/`,
  ])("normalizes %s to one canonical track URL", url => {
    expect(parseContextUrl(url)).toEqual({
      provider: "spotify",
      kind: "track",
      id: trackId,
      url: canonical,
    });
  });
  it("creates identical requests for every variation of the same track", async () => {
    const rpc = vi.fn(async (_name: string, _params: Record<string, unknown>) => ({
      id: requestId,
      status: "queued",
    }));
    for (const url of [
      `${canonical}?si=first`,
      `https://open.spotify.com/intl-fr/track/${trackId}/`,
    ])
      await processContextOperation(
        actor,
        { action: "ingest", url, idempotency_key: "same" },
        { rpc, dispatch: vi.fn() },
      );
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_track: trackId, p_input: { url: canonical } });
  });
});

describe("album, playlist and artist routing", () => {
  const album = "https://open.spotify.com/album/abcdefghijklmnopqrstuv";
  const playlist = "https://open.spotify.com/playlist/AAAAAAAAAAAAAAAAAAAAAA";
  const artist = "https://open.spotify.com/intl-es/artist/1234567890123456789012?si=x";
  it("routes an album URL to ingest_release instead of track ingestion", () => {
    expect(() => parseContextUrl(album)).toThrow(ContextIngestFailure);
    expect(() => parseContextUrl(album)).toThrow(/ingest_release/);
    expect(classifyContextIngestFailure(captureError(() => parseContextUrl(album)))).toBe(
      "unsupported_input",
    );
  });
  it("names playlists as unsupported rather than silently rejecting them", () => {
    expect(() => parseContextUrl(playlist)).toThrow(/playlist/i);
    expect(() => parseContextUrl(playlist)).toThrow(/not supported/);
  });
  it("names artist pages as non-track input", () => {
    expect(() => parseContextUrl(artist)).toThrow(/artist/i);
    expect(classifyContextIngestFailure(captureError(() => parseContextUrl(artist)))).toBe(
      "unsupported_input",
    );
  });
  it("surfaces the routing message in schema issues for the HTTP 400 body", () => {
    const parsed = contextIngestSchema.safeParse({ url: album, idempotency_key: "release-1" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].path).toEqual(["url"]);
    expect(parsed.error.issues[0].message).toMatch(/ingest_release/);
    const response = validateContextOperationBody({
      action: "ingest",
      url: playlist,
      idempotency_key: "release-1",
    });
    expect(response).not.toHaveProperty("action");
    if (!("status" in response)) throw new Error("expected a 400 response");
    expect(response.status).toBe(400);
  });
  it("keeps a generic message for input that is not a URL identity at all", () => {
    const parsed = contextIngestSchema.safeParse({
      url: "https://example.com/not-music",
      idempotency_key: "release-1",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].message).toMatch(/Spotify track/);
  });
});

describe("provider fetch failure states", () => {
  it.each([
    [404, "recording_unavailable"],
    [410, "recording_unavailable"],
    [429, "provider_outage"],
    [500, "provider_outage"],
    [503, "provider_outage"],
    [401, "provider_rejected"],
    [403, "provider_rejected"],
  ])("maps HTTP %s to %s", async (status, code) => {
    const error = await captureRejection(
      fetchSpotifyContext(
        trackId,
        "token",
        vi.fn().mockResolvedValue(new Response("", { status })),
      ),
    );
    expect(error).toBeInstanceOf(ContextIngestFailure);
    expect((error as ContextIngestFailure).code).toBe(code);
    expect((error as Error).message).toContain(String(status));
  });
  it("treats a timeout as a provider outage", () => {
    expect(classifyContextIngestFailure(new DOMException("timed out", "TimeoutError"))).toBe(
      "provider_outage",
    );
    expect(classifyContextIngestFailure(new DOMException("aborted", "AbortError"))).toBe(
      "provider_outage",
    );
  });
  it("treats an incomplete provider payload as an invalid response, not a missing recording", async () => {
    const error = await captureRejection(
      fetchSpotifyContext(
        trackId,
        "token",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...track, external_ids: {} }))),
      ),
    );
    expect(error).toBeInstanceOf(ZodError);
    expect(classifyContextIngestFailure(error)).toBe("provider_response_invalid");
  });
  it("treats a relinked recording as an identity conflict", async () => {
    const error = await captureRejection(
      fetchSpotifyContext(
        trackId,
        "token",
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ ...track, id: "AAAAAAAAAAAAAAAAAAAAAA" })),
          ),
      ),
    );
    expect(error).toBeInstanceOf(ContextIngestFailure);
    expect(classifyContextIngestFailure(error)).toBe("identity_conflict");
  });
  it.each([
    ["Conflicting recording identity", "identity_conflict"],
    ["Conflicting artist identity", "identity_conflict"],
    ["Recording mismatch", "identity_conflict"],
    ["Context storage operation failed: Conflicting recording identity", "identity_conflict"],
    ["Verified ISRC required", "provider_response_invalid"],
    ["Context storage operation failed: Verified ISRC required", "provider_response_invalid"],
  ])("classifies the database exception %j as %s", (message, code) => {
    expect(classifyContextIngestFailure(new Error(message))).toBe(code);
  });
  it("returns unknown for unrelated errors instead of guessing", () => {
    expect(classifyContextIngestFailure(new Error("revoked"))).toBe("unknown");
    expect(classifyContextIngestFailure("string")).toBe("unknown");
    expect(classifyContextIngestFailure(undefined)).toBe("unknown");
  });
});

describe("persisted failure descriptions", () => {
  const codes = [
    "unsupported_input",
    "recording_unavailable",
    "provider_outage",
    "provider_rejected",
    "provider_response_invalid",
    "identity_conflict",
    "unknown",
  ] as const;
  it.each(codes)("starts with %s and offers recovery guidance", code => {
    const text = describeContextIngestFailure(new ContextIngestFailure(code, "detail"));
    expect(text.startsWith(`${code}: `)).toBe(true);
    expect(text.length).toBeGreaterThan(code.length + 10);
    expect(text.length).toBeLessThan(1000);
  });
  it("never echoes a raw provider body", () => {
    const body = "<html>secret provider payload</html>";
    expect(describeContextIngestFailure(new Error(body))).not.toContain(body);
  });
});

describe("request failure persistence", () => {
  const request = {
    id: requestId,
    owner_id: "owner",
    created_by: "actor",
    input: { url: canonical, topics: ["release_metadata"] },
    status: "queued",
  };
  function setup(extract: () => Promise<unknown>, commit?: () => Promise<unknown>) {
    const rpc = vi.fn(async (name: string) => {
      if (name === "read_context_request") return request;
      if (name === "claim_context_request") return true;
      if (name === "commit_spotify_context" && commit) return commit();
      return { ...request, status: "completed" };
    });
    return { rpc, authorize: vi.fn(async () => undefined), extract: vi.fn(extract) };
  }
  function failure(deps: ReturnType<typeof setup>) {
    const call = deps.rpc.mock.calls.find(([name]) => name === "fail_context_request");
    expect(call).toBeDefined();
    return (call as unknown[])[1] as { p_error: string; p_request: string };
  }
  it("records a deleted track without creating any artist record", async () => {
    const deps = setup(async () => {
      throw await captureRejection(
        fetchSpotifyContext(
          trackId,
          "token",
          vi.fn().mockResolvedValue(new Response("", { status: 404 })),
        ),
      );
    });
    await expect(runContextRequest("actor", "owner", requestId, deps as never)).rejects.toThrow();
    const failed = failure(deps);
    expect(failed.p_request).toBe(requestId);
    expect(failed.p_error.startsWith("recording_unavailable: ")).toBe(true);
    expect(deps.rpc.mock.calls.some(([name]) => name === "commit_spotify_context")).toBe(false);
  });
  it.each([
    ["503", new ContextIngestFailure("provider_outage", "Spotify metadata request failed: 503")],
    ["429", new ContextIngestFailure("provider_outage", "Spotify metadata request failed: 429")],
    ["timeout", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
  ])("records a provider outage (%s) as retryable with the same key", async (_, error) => {
    const deps = setup(async () => {
      throw error;
    });
    await expect(runContextRequest("actor", "owner", requestId, deps as never)).rejects.toThrow();
    const failed = failure(deps);
    expect(failed.p_error.startsWith("provider_outage: ")).toBe(true);
    expect(failed.p_error).toMatch(/same idempotency key/);
    expect(deps.rpc.mock.calls.some(([name]) => name === "commit_spotify_context")).toBe(false);
  });
  it("records a conflicting identity from commit after exactly one extraction", async () => {
    const deps = setup(
      async () => ({ trackId }),
      async () => {
        throw new Error("Context storage operation failed: Conflicting artist identity");
      },
    );
    await expect(runContextRequest("actor", "owner", requestId, deps as never)).rejects.toThrow(
      "Conflicting artist identity",
    );
    expect(deps.extract).toHaveBeenCalledTimes(1);
    const failed = failure(deps);
    expect(failed.p_error.startsWith("identity_conflict: ")).toBe(true);
    expect(failed.p_error).toMatch(/no artist record was created/);
  });
  it("records an invalid provider payload distinctly", async () => {
    const deps = setup(async () => {
      throw await captureRejection(
        fetchSpotifyContext(
          trackId,
          "token",
          vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...track, external_ids: {} }))),
        ),
      );
    });
    await expect(runContextRequest("actor", "owner", requestId, deps as never)).rejects.toThrow();
    expect(failure(deps).p_error.startsWith("provider_response_invalid: ")).toBe(true);
  });
  it("keeps every persisted message within the 1000 character error budget", async () => {
    const deps = setup(async () => {
      throw new Error("x".repeat(5000));
    });
    await expect(runContextRequest("actor", "owner", requestId, deps as never)).rejects.toThrow();
    const failed = failure(deps);
    expect(failed.p_error.startsWith("unknown: ")).toBe(true);
    expect(failed.p_error.length).toBeLessThanOrEqual(1000);
    expect(failed.p_error).not.toContain("xxxx");
  });
});

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a thrown error");
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
}
