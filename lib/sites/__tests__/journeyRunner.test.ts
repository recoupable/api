import { expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { enforceJourneyReview } from "../production/enforceJourneyReview";
import { journeyRunner } from "../production/journeyRunner";
it.each([
  {
    name: "known-good",
    brokenHidden: false,
    brokenJs: false,
    deadGame: false,
    mobileOverflow: false,
  },
  {
    name: "hidden override",
    brokenHidden: true,
    brokenJs: false,
    deadGame: false,
    mobileOverflow: false,
  },
  {
    name: "broken-JavaScript",
    brokenHidden: false,
    brokenJs: true,
    deadGame: false,
    mobileOverflow: false,
  },
  {
    name: "nonfunctional-game",
    brokenHidden: false,
    brokenJs: false,
    deadGame: true,
    mobileOverflow: false,
  },
  {
    name: "mobile-overflow-before-restart",
    brokenHidden: false,
    brokenJs: false,
    deadGame: false,
    mobileOverflow: true,
  },
])(
  "retains objective evidence for $name",
  async ({ brokenHidden, brokenJs, deadGame, mobileOverflow }) => {
    let report: { name: string; journeyPassed: boolean; errors: string[]; overflow: boolean }[] =
      [];
    let mobile = false;
    let onError: (error: Error) => void = () => {};
    let visible = "Start";
    const captures: Record<string, string> = {};
    const body = {
      evaluateAll: async () => [],
      waitFor: async () => {},
      innerText: async () => visible,
      evaluate: async (fn: () => unknown) =>
        runInNewContext("(" + fn.toString() + ")()", {
          window: { __recoupEvents: ["complete"] },
          document: {
            documentElement: {
              scrollWidth:
                mobileOverflow && mobile && visible === "Playing" ? 800 : mobile ? 390 : 1440,
            },
          },
          innerWidth: mobile ? 390 : 1440,
        }),
    };
    const ui = {
      locator: (selector: string) =>
        selector.startsWith("[hidden]")
          ? {
              evaluateAll: async (fn: (...args: unknown[]) => unknown) =>
                runInNewContext("(" + fn.toString() + ")(nodes)", {
                  nodes: [
                    {
                      id: "hint",
                      tagName: "DIV",
                      getClientRects: () => (brokenHidden ? [{ width: 100, height: 44 }] : []),
                    },
                  ],
                  getComputedStyle: () => ({
                    display: brokenHidden ? "flex" : "none",
                    visibility: "visible",
                  }),
                }),
            }
          : body,
      getByRole: (_: string, { name }: { name: string }) => ({
        click: async () => {
          if (deadGame) return;
          visible =
            name === "Finish" ? "Your earned result" : name === "Reset" ? "Start" : "Playing";
        },
      }),
      getByText: (expected: string) => ({
        first: () => ({
          waitFor: async () => {
            if (!visible.includes(expected))
              throw new Error("Expected state not reached: " + expected);
          },
        }),
      }),
    };
    const page = {
      on: (_event: string, callback: typeof onError) => {
        onError = callback;
      },
      exposeFunction: async () => {},
      addInitScript: async () => {},
      route: async () => {},
      goto: async () => {
        visible = "Start";
      },
      setContent: async () => {
        if (brokenJs) onError(new Error("Synthetic startup failure"));
      },
      locator: () => ({ evaluate: async () => {} }),
      frameLocator: () => ui,
      screenshot: async ({ path }: { path: string }) => {
        captures[path] = visible;
      },
      close: async () => {},
    };
    const plan = {
      steps: [
        { action: "click", target: "Play", expected: "Playing", checkpoint: "participate" },
        { action: "click", target: "Finish", expected: "Your earned result", checkpoint: "result" },
        { action: "click", target: "Reset", expected: "Start", checkpoint: "delivery" },
      ],
    };
    await runInNewContext(journeyRunner, {
      require: (name: string) =>
        name === "node:fs"
          ? {
              readFileSync: (path: string) => (path === "journey.json" ? JSON.stringify(plan) : ""),
              writeFileSync: (_: string, data: string) => {
                report = JSON.parse(data);
              },
            }
          : name === "playwright-core"
            ? {
                chromium: {
                  launch: async () => ({
                    newPage: async ({ viewport }: { viewport: { width: number } }) => {
                      mobile = viewport.width === 390;
                      return page;
                    },
                    close: async () => {},
                  }),
                },
              }
            : { executablePath: async () => "chromium", args: [] },
      console,
      process: {
        exit: () => {
          throw new Error("Runner failed");
        },
      },
    });
    expect(report).toHaveLength(2);
    for (const item of report)
      expect(item.errors.some(error => error.includes("Hidden elements remain visible"))).toBe(
        brokenHidden,
      );
    const verdict = enforceJourneyReview(
      { verdict: "pass", issues: [], summary: "Synthetic model pass" },
      report,
    );
    expect(verdict.verdict).toBe(
      brokenHidden || brokenJs || deadGame || mobileOverflow ? "revise" : "pass",
    );
    if (mobileOverflow) {
      expect(report.find(r => r.name === "mobile")?.overflow).toBe(true);
      expect(report.find(r => r.name === "desktop")?.overflow).toBe(false);
    }
    if (deadGame) {
      expect(report.every(r => !r.journeyPassed)).toBe(true);
      return;
    }
    for (const name of ["mobile", "desktop"]) {
      expect(captures[name + "-first-action.png"]).toBe("Playing");
      expect(captures[name + "-checkpoint-result.png"]).toBe("Your earned result");
      expect(captures[name + "-active.png"]).toBe("Start");
    }
  },
);
