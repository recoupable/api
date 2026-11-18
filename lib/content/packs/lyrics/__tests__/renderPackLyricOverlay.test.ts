import { it, expect, vi } from "vitest";
import { renderPackLyricOverlay } from "../renderPackLyricOverlay";
import { buildPackLyricRenderPlan } from "../buildPackLyricRenderPlan";
import { verifiedLyricAlignmentFixture } from "./fixtures/verifiedLyricAlignment";
it("refuses failed rendering rather than reading/storing partial output", async () => {
  const runtime = {
    writeFiles: vi.fn(),
    runCommand: vi.fn().mockResolvedValue({ exitCode: 1, stdout: async () => "synthetic failure" }),
    fileSize: vi.fn(),
    readFileToBuffer: vi.fn(),
  };
  const plan = buildPackLyricRenderPlan(verifiedLyricAlignmentFixture(), 5, 3, "a".repeat(64));
  await expect(
    renderPackLyricOverlay(runtime as never, "ffmpeg", "ffprobe", plan),
  ).rejects.toThrow();
  expect(runtime.readFileToBuffer).not.toHaveBeenCalled();
});
