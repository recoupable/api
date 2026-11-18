import { expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { coverHiddenReviewRunner } from "../production/coverHiddenReviewRunner";

it.each([true, false])(
  "executes supplemental runner with synthetic ports, artwork available=%s",
  async available => {
    const url = "https://assets.example/cover.png";
    const captures: string[] = [];
    const written: Record<string, string> = {};
    const stop = vi.fn();
    const launch = vi.fn();
    const timer = vi.fn(() => 1);
    const clear = vi.fn();
    const image = { index: 0, src: url, box: { x: 0, y: 0, width: 100, height: 100 } };
    const ui = {
      locator: (selector: string) =>
        selector === "body"
          ? { waitFor: async () => {} }
          : { count: async () => 1, evaluateAll: async () => [image] },
    };
    const loaded: string[] = [];
    const page = {
      setDefaultTimeout: vi.fn(),
      route: vi.fn(),
      goto: vi.fn(),
      setContent: vi.fn(),
      locator: () => ({
        evaluate: async (
          callback: (frame: object, content: string) => Promise<void>,
          content: string,
        ) => {
          const frame = {
            onload: () => {},
            set srcdoc(value: string) {
              loaded.push(value);
              this.onload();
            },
          };
          await callback(frame, content);
        },
      }),
      frameLocator: () => ui,
      screenshot: async ({ path, mask }: { path: string; mask: unknown[] }) => {
        expect(mask).toHaveLength(1);
        captures.push(path);
      },
      close: vi.fn(),
    };
    launch.mockResolvedValue({ newPage: async () => page, close: stop });
    await runInNewContext(coverHiddenReviewRunner, {
      require: (name: string) =>
        name === "node:fs"
          ? {
              readFileSync: (path: string) =>
                path === "cover-review.json"
                  ? JSON.stringify({
                      artworkUrl: available ? url : null,
                      status: "missing-input",
                      reason: "No artwork",
                    })
                  : "<img>",
              writeFileSync: (path: string, value: string) => {
                written[path] = value;
              },
            }
          : name === "playwright-core"
            ? { chromium: { launch } }
            : { executablePath: async () => "chromium", args: ["--disable-web-security"] },
      setTimeout: timer,
      clearTimeout: clear,
      process: {
        exit: () => {
          throw Error("Unexpected runner exit");
        },
      },
      console,
    });
    expect(timer).toHaveBeenCalledWith(expect.any(Function), 30000);
    expect(clear).toHaveBeenCalledWith(1);
    const reports = JSON.parse(written["cover-review-report.json"]);
    expect(reports.map((r: { name: string }) => r.name)).toEqual(["mobile", "desktop"]);
    if (available) {
      expect(loaded).toEqual(["<img>", "<img>"]);
      expect(reports).toEqual(
        ["mobile", "desktop"].map(name =>
          expect.objectContaining({ name, status: "captured", masked: [image] }),
        ),
      );
      expect(captures).toEqual(["mobile-cover-hidden.png", "desktop-cover-hidden.png"]);
      expect(stop).toHaveBeenCalledOnce();
      expect(launch).toHaveBeenCalledWith(expect.objectContaining({ args: [], timeout: 10000 }));
    } else {
      expect(launch).not.toHaveBeenCalled();
      expect(reports.every((r: { status: string }) => r.status === "missing-input")).toBe(true);
    }
  },
);
