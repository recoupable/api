import { expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { coverHiddenRunner } from "../production/coverHiddenRunner";
import { prepareCoverHiddenReview } from "../production/prepareCoverHiddenReview";
import type { SiteSnapshot } from "../schema";
const url = "https://assets.example/cover.png";
const snapshot = {
  assets: [{ type: "image", url }],
  design: { experience: { html: "<img>", css: "", javascript: "" } },
  brandWorld: { specification: { direction: { coverHiddenTest: "angular framing" } } },
} as unknown as SiteSnapshot;
it("binds a permitted cover and selected visual world to exact candidate bytes without collecting assets", () => {
  const result = prepareCoverHiddenReview(snapshot, url);
  expect(result.artworkUrl).toBe(url);
  expect(result.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.brandWorldSha256).toMatch(/^[a-f0-9]{64}$/);
  const changed = structuredClone(snapshot);
  changed.brandWorld!.specification.direction.coverHiddenTest = "paper framing";
  expect(prepareCoverHiddenReview(changed, url).brandWorldSha256).not.toBe(result.brandWorldSha256);
  expect(prepareCoverHiddenReview(snapshot, "https://other.example/cover").artworkUrl).toBeNull();
  expect(prepareCoverHiddenReview(snapshot, null).status).toBe("missing-input");
});
it.each(["captured", "no-match", "too-many", "failure"])(
  "runs real cover capture with synthetic browser ports: %s",
  async scenario => {
    const screenshot = vi.fn(async () => {
      if (scenario === "failure") throw Error("screenshot");
    });
    const images = {
      count: async () => (scenario === "too-many" ? 201 : 1),
      evaluateAll: async () =>
        scenario === "no-match"
          ? []
          : [{ index: 0, src: url, box: { x: 4, y: 8, width: 200, height: 200 } }],
    };
    const ui = { locator: vi.fn((_selector: string) => images) };
    const capture = runInNewContext("(" + coverHiddenRunner + ")");
    const result = await capture({ screenshot }, ui, "mobile", {
      artworkUrl: url,
      status: "ready",
    });
    expect(result.status).toBe(scenario === "captured" ? "captured" : "unverified");
    if (scenario === "captured")
      expect(screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "mobile-cover-hidden.png",
          style: expect.stringContaining("visibility: hidden !important"),
          timeout: 5000,
        }),
      );
    else if (scenario !== "failure") expect(screenshot).not.toHaveBeenCalled();
    expect(ui.locator.mock.calls.every(call => call[0] === "img")).toBe(true);
  },
);
it("executes exact URL and visibility matching without hiding unrelated images or changing DOM", async () => {
  const make = (src: string, visible = true) => ({
    currentSrc: src,
    getAttribute: () => src,
    hasAttribute: () => false,
    closest: () => null,
    complete: true,
    naturalWidth: 400,
    getBoundingClientRect: () => ({ x: 4, y: 8, right: 204, bottom: 208, width: 200, height: 200 }),
    visible,
  });
  const nodes = [make("https://assets.example/reference.png"), make(url), make(url, false)];
  const before = nodes.map(n => n.currentSrc);
  const styles: string[] = [];
  const images = {
    count: async () => nodes.length,
    evaluateAll: async (fn: (...args: never[]) => unknown, arg: unknown) =>
      runInNewContext("(" + fn.toString() + ")(nodes,arg)", {
        nodes,
        arg,
        getComputedStyle: (n: { visible: boolean }) => ({
          display: "block",
          visibility: n.visible ? "visible" : "hidden",
          opacity: "1",
        }),
        innerWidth: 390,
        innerHeight: 844,
      }),
  };
  const capture = runInNewContext("(" + coverHiddenRunner + ")");
  const result = await capture(
    { screenshot: async (options: { style: string }) => styles.push(options.style) },
    { locator: () => images },
    "mobile",
    { artworkUrl: url },
  );
  expect(result.masked.map((m: { index: number }) => m.index)).toEqual([1]);
  expect(styles[0]).toContain(":not([srcset]):not(picture img)");
  expect(styles[0]).not.toContain("nth");
  expect(nodes.map(n => n.currentSrc)).toEqual(before);
});
it("rejects changed image ordering instead of binding stale indices to a capture", async () => {
  let calls = 0;
  const images = {
    count: async () => 1,
    evaluateAll: async () => [
      { index: calls++, src: url, box: { x: 0, y: 0, width: 100, height: 100 } },
    ],
  };
  const screenshot = vi.fn();
  const capture = runInNewContext("(" + coverHiddenRunner + ")");
  const result = await capture({ screenshot }, { locator: () => images }, "mobile", {
    artworkUrl: url,
  });
  expect(result.status).toBe("unverified");
  expect(result.masked).toEqual([]);
  expect(screenshot.mock.calls[0][0]).not.toHaveProperty("mask");
});
