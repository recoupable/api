import { it, expect, vi, afterEach } from "vitest";
import { callContextMusicPreset } from "../callContextMusicPreset";
afterEach(() => vi.unstubAllGlobals());
it("records full candidate audio without claiming complete analysis coverage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", response: "analysis" }),
    }),
  );
  const result = await callContextMusicPreset(
    "https://example.com/audio.m4a",
    "catalog_metadata",
    "secret",
    { coverage: "full_duration_candidate", durationSeconds: 152.23 },
  );
  expect(result.coverage).toBe("unknown");
  expect(JSON.stringify(result.trace)).toContain("full_duration_candidate");
  expect(JSON.stringify(result.trace)).not.toContain("secret");
});
