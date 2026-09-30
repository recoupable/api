import { beforeEach, expect, it, vi } from "vitest";
import { audioSourceStep } from "@/app/workflows/sites/audioSourceStep";
import { acquireSiteContextAudio } from "../production/acquireSiteContextAudio";
vi.mock("../production/acquireSiteContextAudio", () => ({ acquireSiteContextAudio: vi.fn() }));
vi.mock("workflow", () => ({ FatalError: class extends Error {} }));
beforeEach(() => vi.resetAllMocks());
it("returns an explicit album gap for rejected audio", async () => {
  vi.mocked(acquireSiteContextAudio).mockRejectedValue(
    new Error("No hosted audio passed recording verification"),
  );
  expect(await audioSourceStep({} as never, "account", {} as never, true)).toEqual({
    status: "unavailable",
    reason: "No hosted audio passed recording verification",
  });
});
it("never turns account or infrastructure errors into missing music", async () => {
  vi.mocked(acquireSiteContextAudio).mockRejectedValue(new Error("Unauthorized"));
  await expect(audioSourceStep({} as never, "account", {} as never, true)).rejects.toThrow();
});
it("preserves strict behavior for single recordings", async () => {
  vi.mocked(acquireSiteContextAudio).mockRejectedValue(
    new Error("No hosted audio passed recording verification"),
  );
  await expect(audioSourceStep({} as never, "account", {} as never)).rejects.toThrow();
});
