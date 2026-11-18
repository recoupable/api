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
          mask: [images],
          maskColor: "#808080",
          timeout: 5000,
        }),
      );
    else if (scenario !== "failure") expect(screenshot).not.toHaveBeenCalled();
    expect(ui.locator.mock.calls[0][0]).toBe("img");
    expect(
      ui.locator.mock.calls
        .slice(1)
        .every(call => call[0].startsWith("img[src=") && !call[0].includes("nth")),
    ).toBe(true);
  },
);
it("uses source-exact browser masks despite inline visibility important, without positional targets or DOM changes", async () => {
  const make = (src: string, visible = true) => ({
    currentSrc: src,
    style: { cssText: "visibility:visible!important" },
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
  const selectors: string[] = [];
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
    { screenshot: async () => {} },
    {
      locator: (selector: string) => {
        selectors.push(selector);
        return selector === "img" ? images : { count: async () => 1 };
      },
    },
    "mobile",
    { artworkUrl: url },
  );
  expect(result.masked.map((m: { index: number }) => m.index)).toEqual([1]);
  expect(selectors[1]).toContain(":not([srcset]):not(picture img)");
  expect(selectors[1]).not.toContain("nth");
  expect(nodes.map(n => n.currentSrc)).toEqual(before);
  expect(nodes.every(n => n.style.cssText === "visibility:visible!important")).toBe(true);
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
  expect(screenshot.mock.calls[0][0]).toHaveProperty("mask");
  expect(screenshot.mock.calls[0][0]).not.toHaveProperty("style");
});
it("refuses an extra transparent full-viewport source match omitted by visible-cover inspection", async () => {
  const screenshot = vi.fn();
  const inspect = {
    count: async () => 2,
    evaluateAll: async () => [{ index: 0, src: url, box: { x: 0, y: 0, width: 100, height: 100 } }],
  };
  // Playwright :visible also includes the second opacity:0 image; never mask that larger set.
  const targets = { count: async () => 2 };
  const capture = runInNewContext("(" + coverHiddenRunner + ")");
  const result = await capture(
    { screenshot },
    { locator: (selector: string) => (selector === "img" ? inspect : targets) },
    "mobile",
    { artworkUrl: url },
  );
  expect(result.status).toBe("unverified");
  expect(result.masked).toEqual([]);
  expect(screenshot).not.toHaveBeenCalled();
});

it.each(["transparent-parent", "over-depth"])(
  "rejects unsupported ancestor visibility: %s",
  async scenario => {
    let parent: object | null = null;
    for (let i = 0; i < (scenario === "over-depth" ? 65 : 1); i++) {
      parent = { parentElement: parent, opacity: scenario === "transparent-parent" ? "0" : "1" };
    }
    const nodes = [
      {
        parentElement: parent,
        opacity: "1",
        currentSrc: url,
        getAttribute: () => url,
        hasAttribute: () => false,
        closest: () => null,
        complete: true,
        naturalWidth: 400,
        getBoundingClientRect: () => ({
          x: 0,
          y: 0,
          right: 100,
          bottom: 100,
          width: 100,
          height: 100,
        }),
      },
    ];
    const images = {
      count: async () => 1,
      evaluateAll: async (fn: (...args: never[]) => unknown, arg: unknown) =>
        runInNewContext("(" + fn.toString() + ")(nodes,arg)", {
          nodes,
          arg,
          innerWidth: 390,
          innerHeight: 844,
          getComputedStyle: (node: { opacity: string }) => ({
            display: "block",
            visibility: "visible",
            opacity: node.opacity,
          }),
        }),
    };
    const screenshot = vi.fn();
    const capture = runInNewContext("(" + coverHiddenRunner + ")");
    const result = await capture({ screenshot }, { locator: () => images }, "mobile", {
      artworkUrl: url,
    });
    expect(result.status).toBe("unverified");
    expect(result.masked).toEqual([]);
    expect(screenshot).not.toHaveBeenCalled();
  },
);
