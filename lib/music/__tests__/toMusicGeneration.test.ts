import { describe, it, expect } from "vitest";
import { toMusicGeneration } from "../toMusicGeneration";

const row = (over: Record<string, unknown> = {}) =>
  ({
    id: "11111111-2222-4333-8444-555555555555",
    account_id: "550e8400-e29b-41d4-a716-446655440000",
    status: "pending",
    model: "minimax/music-3",
    prompt: "Genre: acoustic pop.",
    lyrics: "[verse]\nMorning light",
    duration_seconds: null,
    storage_key: null,
    fal_request_id: null,
    workflow_run_id: null,
    error_message: null,
    created_at: "2026-08-21T12:00:00.000Z",
    updated_at: "2026-08-21T12:00:00.000Z",
    ...over,
  }) as never;

describe("toMusicGeneration", () => {
  it("returns the documented fields for a pending generation", () => {
    expect(toMusicGeneration(row())).toEqual({
      id: "11111111-2222-4333-8444-555555555555",
      status: "pending",
      prompt: "Genre: acoustic pop.",
      lyrics: "[verse]\nMorning light",
      model: "minimax/music-3",
      duration_seconds: null,
      audio_url: null,
      error_message: null,
      created_at: "2026-08-21T12:00:00.000Z",
      updated_at: "2026-08-21T12:00:00.000Z",
    });
  });

  it("never leaks the owning account or the external handles", () => {
    const result = toMusicGeneration(
      row({ storage_key: "music/abc.wav", fal_request_id: "req_1", workflow_run_id: "run_1" }),
    ) as Record<string, unknown>;

    for (const internal of ["account_id", "storage_key", "fal_request_id", "workflow_run_id"]) {
      expect(result).not.toHaveProperty(internal);
    }
  });

  it("serves the mirrored storage object once one exists", () => {
    const result = toMusicGeneration(row({ status: "completed", storage_key: "music/abc.wav" }));

    expect(result.audio_url).toContain("music/abc.wav");
  });

  it("has no audio url until the mirror lands", () => {
    // There is no fal-url fallback: the row is only playable once the audio is
    // in our own bucket, which is also when it reports completed.
    expect(toMusicGeneration(row({ status: "processing" })).audio_url).toBeNull();
  });

  it("carries the failure reason through so the gallery can render it", () => {
    const result = toMusicGeneration(
      row({ status: "failed", error_message: "Lyrics structure tags were rejected." }),
    );

    expect(result.error_message).toBe("Lyrics structure tags were rejected.");
  });
});
