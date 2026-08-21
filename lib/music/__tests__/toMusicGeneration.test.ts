import { describe, it, expect } from "vitest";
import { toMusicGeneration } from "../toMusicGeneration";

const row = (over: Record<string, unknown> = {}) =>
  ({
    id: "11111111-2222-3333-4444-555555555555",
    account_id: "550e8400-e29b-41d4-a716-446655440000",
    organization_id: null,
    status: "pending",
    model: "minimax/music-3",
    prompt: "Genre: acoustic pop.",
    lyrics: "[verse]\nMorning light",
    title: null,
    requested_duration_seconds: 60,
    duration_seconds: null,
    seed: null,
    num_inference_steps: 30,
    guidance_scale: 1.7,
    fal_request_id: null,
    workflow_run_id: null,
    source_url: null,
    storage_key: null,
    mime_type: null,
    file_size_bytes: null,
    credits_charged: null,
    logs: [],
    error_message: null,
    created_at: "2026-08-21T12:00:00.000Z",
    updated_at: "2026-08-21T12:00:00.000Z",
    ...over,
  }) as never;

describe("toMusicGeneration", () => {
  it("returns the documented fields for a pending generation", () => {
    expect(toMusicGeneration(row())).toEqual({
      id: "11111111-2222-3333-4444-555555555555",
      status: "pending",
      prompt: "Genre: acoustic pop.",
      lyrics: "[verse]\nMorning light",
      title: null,
      model: "minimax/music-3",
      duration_seconds: null,
      seed: null,
      num_inference_steps: 30,
      guidance_scale: 1.7,
      audio_url: null,
      mime_type: null,
      file_size_bytes: null,
      organization_id: null,
      error_message: null,
      created_at: "2026-08-21T12:00:00.000Z",
      updated_at: "2026-08-21T12:00:00.000Z",
    });
  });

  it("never leaks internal columns a client has no use for", () => {
    const result = toMusicGeneration(row({ storage_key: "music/abc.wav" })) as Record<
      string,
      unknown
    >;

    for (const internal of [
      "account_id",
      "storage_key",
      "source_url",
      "fal_request_id",
      "workflow_run_id",
      "credits_charged",
      "requested_duration_seconds",
    ]) {
      expect(result).not.toHaveProperty(internal);
    }
  });

  it("serves the mirrored storage object once one exists", () => {
    const result = toMusicGeneration(
      row({ status: "completed", storage_key: "music/abc.wav", source_url: "https://fal/x.wav" }),
    );

    expect(result.audio_url).toContain("music/abc.wav");
  });

  it("falls back to the fal url while the mirror has not landed", () => {
    const result = toMusicGeneration(
      row({ status: "processing", source_url: "https://fal/x.wav" }),
    );

    expect(result.audio_url).toBe("https://fal/x.wav");
  });

  it("omits logs, which belong to the single-generation read", () => {
    const result = toMusicGeneration(row({ logs: [{ at: "t", message: "m" }] }));

    expect(result).not.toHaveProperty("logs");
  });
});
