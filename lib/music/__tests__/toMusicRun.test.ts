import { describe, it, expect } from "vitest";
import { toMusicRun } from "../toMusicRun";

const row = (over: Record<string, unknown> = {}) =>
  ({
    id: "11111111-2222-3333-4444-555555555555",
    status: "pending",
    storage_key: null,
    created_at: "2026-08-21T12:00:00.000Z",
    ...over,
  }) as never;

describe("toMusicRun", () => {
  it("maps a pending generation to the queued phase", () => {
    expect(toMusicRun(row())).toMatchObject({
      id: "11111111-2222-3333-4444-555555555555",
      kind: "music",
      state: "queued",
      created_at: "2026-08-21T12:00:00.000Z",
      result: null,
    });
  });

  it("maps processing to generating", () => {
    expect(toMusicRun(row({ status: "processing" })).state).toBe("generating");
  });

  it("maps completed to complete and carries the playable result", () => {
    const run = toMusicRun(row({ status: "completed", storage_key: "music/abc.wav" }));

    expect(run.state).toBe("complete");
    expect(run.result?.generation_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(run.result?.audio_url).toContain("music/abc.wav");
  });

  it("maps failed to failed with no result", () => {
    const run = toMusicRun(row({ status: "failed", error_message: "boom" }));

    expect(run.state).toBe("failed");
    expect(run.result).toBeNull();
  });

  it("treats an unrecognized status as still generating, never as terminal", () => {
    expect(toMusicRun(row({ status: "something_new" })).state).toBe("generating");
  });
});
