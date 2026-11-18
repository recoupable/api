import { expect, it, vi } from "vitest";
import { collectCoverHiddenEvidence } from "../production/collectCoverHiddenEvidence";

it("accepts a bounded report with eight long signed artwork URLs in each viewport", async () => {
  const reports = ["mobile", "desktop"].map(name => ({
    name,
    status: "captured",
    reason: "Exact source",
    masked: Array.from({ length: 8 }, (_, index) => ({
      index,
      src: "https://assets.example/cover?signature=" + "x".repeat(3900),
      box: { x: 0, y: 0, width: 100, height: 100 },
    })),
  }));
  const bytes = Buffer.from(JSON.stringify(reports));
  expect(bytes.length).toBeGreaterThan(30000);
  const result = await collectCoverHiddenEvidence({
    runCommand: vi.fn(async () => ({ exitCode: 0 })),
    readFileToBuffer: vi.fn(async ({ path }) =>
      path === "cover-review-report.json" ? bytes : Buffer.from("png"),
    ),
  } as unknown as Parameters<typeof collectCoverHiddenEvidence>[0]);
  expect(result.reports).toEqual(reports);
  expect(result.images).toHaveLength(2);
});
