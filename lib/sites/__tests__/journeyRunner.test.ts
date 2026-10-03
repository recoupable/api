import { expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { journeyRunner } from "../production/journeyRunner";
it.each([false, true])(
  "captures payoff and detects CSS overriding hidden (%s)",
  async brokenHidden => {
    let report: { errors: string[] }[] = [];
    let visible = "Start";
    const captures: Record<string, string> = {};
    const body = {
      evaluateAll: async () => [],
      waitFor: async () => {},
      innerText: async () => visible,
      evaluate: async (fn: () => unknown) =>
        String(fn).includes("__recoupEvents") ? ["complete"] : false,
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
          visible =
            name === "Finish" ? "Your earned result" : name === "Reset" ? "Start" : "Playing";
        },
      }),
      getByText: () => ({ first: () => ({ waitFor: async () => {} }) }),
    };
    const page = {
      on: () => {},
      exposeFunction: async () => {},
      addInitScript: async () => {},
      route: async () => {},
      goto: async () => {
        visible = "Start";
      },
      setContent: async () => {},
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
                  launch: async () => ({ newPage: async () => page, close: async () => {} }),
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
    for (const name of ["mobile", "desktop"]) {
      expect(captures[name + "-first-action.png"]).toBe("Playing");
      expect(captures[name + "-checkpoint-result.png"]).toBe("Your earned result");
      expect(captures[name + "-active.png"]).toBe("Start");
    }
  },
);
