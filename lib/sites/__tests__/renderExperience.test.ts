import { beforeEach, expect, it, vi } from "vitest";
import { renderExperience } from "../production/renderExperience";
import type { SiteSnapshot } from "../schema";
const m = vi.hoisted(() => ({
  create: vi.fn(),
  runCommand: vi.fn(),
  extendTimeout: vi.fn(),
  updateNetworkPolicy: vi.fn(),
  writeFiles: vi.fn(),
  readFileToBuffer: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: m.create } }));
const snapshot = {
  assets: [],
  design: { experience: { html: "", css: "", javascript: "" } },
} as unknown as SiteSnapshot;
beforeEach(() => {
  vi.resetAllMocks();
  m.create.mockResolvedValue(m);
  m.runCommand.mockResolvedValue({ exitCode: 0 });
  m.readFileToBuffer.mockImplementation(async ({ path }) =>
    Buffer.from(path === "review.json" ? "[]" : "image"),
  );
});
it("reserves browser time after installation and gathers evidence before cleanup", async () => {
  const result = await renderExperience(snapshot);
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: 600000 }));
  expect(m.extendTimeout).toHaveBeenCalledWith(600000);
  expect(m.extendTimeout.mock.invocationCallOrder[0]).toBeGreaterThan(
    m.runCommand.mock.invocationCallOrder[1],
  );
  expect(m.extendTimeout.mock.invocationCallOrder[0]).toBeLessThan(
    m.runCommand.mock.invocationCallOrder[2],
  );
  expect(result.images.length).toBeGreaterThan(0);
  expect(m.stop).toHaveBeenCalledOnce();
});
it("preserves the actual failure when cleanup also returns Gone", async () => {
  m.runCommand.mockRejectedValueOnce(new Error("Dependency download failed"));
  m.stop.mockRejectedValueOnce(new Error("Status code 410 is not ok"));
  await expect(renderExperience(snapshot)).rejects.toThrow(
    "Site review dependency installation failed: Dependency download failed",
  );
});
it("does not discard collected evidence when sandbox cleanup fails", async () => {
  m.stop.mockRejectedValueOnce(new Error("Status code 410 is not ok"));
  await expect(renderExperience(snapshot)).resolves.toMatchObject({ report: [] });
});
