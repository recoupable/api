import { beforeEach, expect, it, vi } from "vitest";
import { reviewStep } from "@/app/workflows/sites/reviewStep";
import type { SiteSnapshot } from "../schema";
import type { CreativeDirection } from "../production/schema";
const m = vi.hoisted(() => ({ generate: vi.fn(), read: vi.fn(), write: vi.fn(), create: vi.fn() }));
vi.mock("../production/generateProductionObject", () => ({ generateProductionObject: m.generate }));
vi.mock("../production/compileJourney", () => ({
  compileJourney: vi.fn(async () => ({ steps: [] })),
}));
vi.mock("../production/reviewOpeningSequence", () => ({
  reviewOpeningSequence: vi.fn(async () => ({
    verdict: "pass",
    issues: [],
    summary: "Clear",
    observations: [],
  })),
}));
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: m.create } }));
const url = "https://assets.example/cover.png";
const snapshot = {
  assets: [{ url, type: "image" }],
  design: { experience: { html: '<img src="' + url + '">', css: "", javascript: "" } },
  brandWorld: { specification: { direction: { coverHiddenTest: "angular framing" } } },
} as unknown as SiteSnapshot;
const reports = ["mobile", "desktop"].map(name => ({
  name,
  journeyPassed: true,
  errors: [],
  overflow: false,
  coverHidden: {
    status: "captured",
    reason: "Exact inline cover mask",
    masked: [{ index: 0, src: url, box: { x: 0, y: 0, width: 100, height: 100 } }],
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  m.create.mockResolvedValue({
    runCommand: vi.fn(async () => ({ exitCode: 0 })),
    extendTimeout: vi.fn(),
    updateNetworkPolicy: vi.fn(),
    writeFiles: m.write,
    readFileToBuffer: m.read,
    stop: vi.fn(),
  });
  m.read.mockImplementation(async ({ path }) =>
    path === "review.json"
      ? Buffer.from(JSON.stringify(reports))
      : path === "cover-review-report.json"
        ? Buffer.from(JSON.stringify(reports.map(r => ({ name: r.name, ...r.coverHidden }))))
        : /^(mobile|desktop)(-active|-first-action|-cover-hidden)?\.png$/.test(path)
          ? Buffer.from(path)
          : null,
  );
  m.generate.mockResolvedValue({
    verdict: "pass",
    issues: [],
    summary: "Distinctive framing",
    coverHiddenCritique: {
      assessment: "expresses-world",
      reasons: ["Angular framing remains"],
      improvements: [],
    },
  });
});
it("connects actual workflow review through rendering and preserves normal/opening image order without another critique call", async () => {
  const result = await reviewStep(
    snapshot,
    { contract: {} } as CreativeDirection,
    "account",
    "site",
    undefined,
    { baseRevision: 7, releaseArtwork: url },
  );
  expect(m.generate).toHaveBeenCalledOnce();
  const args = m.generate.mock.calls[0];
  expect(args[3].map((x: string) => Buffer.from(x.split(",")[1], "base64").toString())).toEqual([
    "mobile.png",
    "mobile-active.png",
    "desktop.png",
    "desktop-active.png",
    "mobile-first-action.png",
    "desktop-first-action.png",
    "mobile-cover-hidden.png",
    "desktop-cover-hidden.png",
  ]);
  expect(args[2].coverHidden.viewports.map((x: { imageIndex: number }) => x.imageIndex)).toEqual([
    6, 7,
  ]);
  expect(result.verification?.coverHidden).toMatchObject({
    baseRevision: 7,
    critique: { assessment: "expresses-world" },
    viewports: [{ status: "captured" }, { status: "captured" }],
  });
  expect(result.verification?.coverHidden?.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.verification?.humanApproval).toBe("not-recorded");
  const files = m.write.mock.calls[0][0];
  expect(
    JSON.parse(
      files.find((f: { path: string }) => f.path === "cover-review.json").content.toString(),
    ).artworkUrl,
  ).toBe(url);
});
it("records missing capture as unverified even if model claims the cover-hidden criterion passed", async () => {
  const read = m.read.getMockImplementation()!;
  m.read.mockImplementation(async arg =>
    arg.path === "desktop-cover-hidden.png" ? null : read(arg),
  );
  const result = await reviewStep(
    snapshot,
    { contract: {} } as CreativeDirection,
    "account",
    "site",
    undefined,
    { baseRevision: 7, releaseArtwork: url },
  );
  expect(result.verification?.coverHidden?.critique.assessment).toBe("unverified");
  expect(result.verification?.coverHidden?.viewports[1].status).toBe("unverified");
  expect(result.verification?.viewports.every(v => v.journeyPassed)).toBe(true);
});
it("keeps subjective repairs distinct from passing objective journey checks", async () => {
  m.generate.mockResolvedValue({
    verdict: "pass",
    issues: [],
    summary: "Journey worked",
    coverHiddenCritique: {
      assessment: "needs-improvement",
      reasons: ["Only the cover supplies the angular language"],
      improvements: ["Use the saved angular framing in the controls"],
    },
  });
  const result = await reviewStep(
    snapshot,
    { contract: {} } as CreativeDirection,
    "account",
    "site",
    undefined,
    { baseRevision: 7, releaseArtwork: url },
  );
  expect(result.verdict).toBe("revise");
  expect(result.issues).toContainEqual(
    expect.objectContaining({
      severity: "visual",
      module: "implementation",
      detail: "Only the cover supplies the angular language",
    }),
  );
  expect(result.verification?.viewports.every(v => v.journeyPassed)).toBe(true);
  expect(m.generate).toHaveBeenCalledOnce();
});
it.each(["malformed", "capture-failure"])(
  "retains normal journey evidence after supplemental %s",
  async failure => {
    const read = m.read.getMockImplementation()!;
    m.read.mockImplementation(async arg =>
      arg.path === "cover-review-report.json"
        ? Buffer.from(failure === "malformed" ? "{}" : "[]")
        : read(arg),
    );
    const result = await reviewStep(
      snapshot,
      { contract: {} } as CreativeDirection,
      "account",
      "site",
      undefined,
      { baseRevision: 7, releaseArtwork: url },
    );
    expect(result.verification?.coverHidden?.critique.assessment).toBe("unverified");
    expect(result.verification?.viewports.every(v => v.journeyPassed)).toBe(true);
    expect(m.generate.mock.calls[0][3]).toHaveLength(6);
  },
);
it.each(["pass", "revise"])(
  "does not promote unsupported negative cover critique into a repair from %s",
  async verdict => {
    const read = m.read.getMockImplementation()!;
    m.read.mockImplementation(async arg =>
      arg.path === "desktop-cover-hidden.png" ? null : read(arg),
    );
    m.generate.mockResolvedValue({
      verdict,
      issues: [],
      summary: "Journey works",
      coverHiddenCritique: {
        assessment: "needs-improvement",
        reasons: ["Guessed defect"],
        improvements: ["Change controls"],
      },
    });
    const result = await reviewStep(
      snapshot,
      { contract: {} } as CreativeDirection,
      "account",
      "site",
      undefined,
      { baseRevision: 7, releaseArtwork: url },
    );
    expect(result.verification?.coverHidden?.critique.assessment).toBe("unverified");
    expect(result.verdict).toBe("pass");
    expect(result.issues).toEqual([]);
  },
);

it("preserves ordinary defects when supplemental cover evidence is missing", async () => {
  const read = m.read.getMockImplementation()!;
  m.read.mockImplementation(async arg =>
    arg.path === "desktop-cover-hidden.png" ? null : read(arg),
  );
  const issue = {
    severity: "visual",
    module: "implementation",
    detail: "Normal view text overlaps controls",
    fix: "Add spacing",
  };
  m.generate.mockResolvedValue({
    verdict: "revise",
    issues: [issue],
    summary: "Ordinary defect",
    coverHiddenCritique: {
      assessment: "needs-improvement",
      reasons: ["Unsupported"],
      improvements: [],
    },
  });
  const result = await reviewStep(
    snapshot,
    { contract: {} } as CreativeDirection,
    "account",
    "site",
    undefined,
    { baseRevision: 7, releaseArtwork: url },
  );
  expect(result.verification?.coverHidden?.critique.assessment).toBe("unverified");
  expect(result.verdict).toBe("revise");
  expect(result.issues).toEqual([issue]);
});
