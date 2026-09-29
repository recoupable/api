import { expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { journeyRunner } from "../production/journeyRunner";
it("captures the earned result before delivery resets the page", async () => {
  let visible = "Start";
  const captures: Record<string, string> = {};
  const body = {
    waitFor: async () => {},
    innerText: async () => visible,
    evaluate: async (fn: () => unknown) =>
      String(fn).includes("__recoupEvents") ? ["complete"] : false,
  };
  const ui = {
    locator: () => body,
    getByRole: (_: string, { name }: { name: string }) => ({
      click: async () => {
        visible = name === "Finish" ? "Your earned result" : name === "Reset" ? "Start" : "Playing";
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
            writeFileSync: () => {},
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
  for (const name of ["mobile", "desktop"]) {
    expect(captures[name + "-checkpoint-result.png"]).toBe("Your earned result");
    expect(captures[name + "-active.png"]).toBe("Start");
  }
});
