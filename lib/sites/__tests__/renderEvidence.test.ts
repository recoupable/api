import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { renderExperience } from "../production/renderExperience";
import type { SiteSnapshot } from "../schema";
import type { ExperienceContract } from "../production/experienceContract";
const m = vi.hoisted(() => ({
  writeFiles: vi.fn(),
  stop: vi.fn(),
  readFileToBuffer: vi.fn(),
}));
vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: vi.fn(async () => ({
      runCommand: vi.fn(async () => ({ exitCode: 0 })),
      extendTimeout: vi.fn(),
      updateNetworkPolicy: vi.fn(),
      ...m,
    })),
  },
}));
const snapshot = {
  assets: [],
  design: {
    experience: { html: "<button>Start</button>", css: "body{margin:0}", javascript: "void 0" },
  },
} as SiteSnapshot;
const contract = { steps: [{ action: "click", target: "Start" }] } as ExperienceContract;
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
beforeEach(() => {
  vi.clearAllMocks();
  m.readFileToBuffer.mockImplementation(async ({ path }: { path: string }) =>
    Buffer.from(path === "review.json" ? "[]" : "synthetic screenshot bytes"),
  );
});
it("binds evidence to the exact document, journey and runner bytes sent for rendering", async () => {
  const result = await renderExperience(snapshot, contract);
  const files = m.writeFiles.mock.calls[0][0] as { path: string; content: Buffer }[];
  const content = (path: string) => files.find(file => file.path === path)!.content;
  expect(result).toHaveProperty("evidence", {
    sourceSha256: hash(content("experience.html")),
    journeySha256: hash(content("journey.json")),
    runnerSha256: hash(content("review.cjs")),
  });
  expect(m.stop).toHaveBeenCalledOnce();
});
it("changes the source binding for a repaired candidate and the plan binding for a repaired test", async () => {
  const first = await renderExperience(snapshot, contract);
  const repaired = structuredClone(snapshot);
  repaired.design.experience!.javascript = "void 1";
  const second = await renderExperience(repaired, contract);
  const third = await renderExperience(repaired, { ...contract, steps: [] });
  expect(first).toHaveProperty("evidence");
  const evidence = (value: unknown) =>
    (value as { evidence: { sourceSha256: string; journeySha256: string } }).evidence;
  expect(evidence(first).sourceSha256).not.toBe(evidence(second).sourceSha256);
  expect(evidence(first).journeySha256).toBe(evidence(second).journeySha256);
  expect(evidence(second).journeySha256).not.toBe(evidence(third).journeySha256);
  expect(evidence(second).sourceSha256).toBe(evidence(third).sourceSha256);
});
it("returns no passing evidence after interrupted collection and still cleans up", async () => {
  m.readFileToBuffer.mockRejectedValueOnce(new Error("Synthetic interrupted collection"));
  await expect(renderExperience(snapshot, contract)).rejects.toThrow("evidence collection failed");
  expect(m.stop).toHaveBeenCalledOnce();
});
