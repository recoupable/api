import { beforeEach, expect, it, vi } from "vitest";
import { advanceSiteBuild } from "../builder/advanceSiteBuild";
import type { SiteBuildState } from "../builder/types";
const mock = vi.hoisted(() => ({ stream: vi.fn(), charge: vi.fn(), credits: vi.fn() }));
vi.mock("ai", async original => ({
  ...(await original<typeof import("ai")>()),
  streamText: mock.stream,
}));
vi.mock("@/lib/credits/handleChatCredits", () => ({ handleChatCredits: mock.charge }));
vi.mock("../production/requireCredits", () => ({ requireCredits: mock.credits }));
const metadata = {
  headline: "Moonwalk",
  eyebrow: "",
  description: "Play",
  buttonLabel: "Start",
  signupHeading: "Join",
  background: "#000000",
  foreground: "#ffffff",
  accent: "#eeeeee",
  layout: "poster",
  font: "sans",
};
const initial = (): SiteBuildState => ({
  site: {
    id: "site",
    name: "Moonwalk",
    assets: [],
    release_url: "",
    brief: "Dance",
  } as SiteBuildState["site"],
  instruction: "Keep the dance",
  brandWorld: {} as SiteBuildState["brandWorld"],
  files: { html: "", css: "", javascript: "" },
  notes: "",
  messages: [],
  inputTokens: 0,
  turns: 0,
  compactions: 0,
});
function response(action: (options: any) => Promise<void>, reason = "tool-calls") {
  mock.stream.mockImplementationOnce((options: any) => ({
    fullStream: (async function* () {
      await action(options);
      yield { type: "finish" };
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
    finishReason: Promise.resolve(reason),
    response: Promise.resolve({ messages: [{ role: "assistant", content: "Saved progress" }] }),
  }));
}
beforeEach(() => vi.clearAllMocks());
it("keeps completed file writes across an output limit and finishes on the next turn", async () => {
  response(async o => {
    await o.tools.write_file.execute({
      file: "html",
      content: "<main>Dance</main>",
      notes: "Add motion next",
    });
  }, "length");
  const first = await advanceSiteBuild(initial(), "account");
  expect(first.snapshot).toBeUndefined();
  expect(first.files.html).toBe("<main>Dance</main>");
  expect(first.notes).toBe("Add motion next");
  response(async o => {
    await o.tools.write_file.execute({
      file: "javascript",
      content: "let dancing = true;",
      notes: "Complete",
    });
    await o.tools.finish.execute({ design: metadata });
  });
  const second = await advanceSiteBuild(first, "account");
  expect(second.snapshot?.design.experience?.html).toBe("<main>Dance</main>");
  expect(second.snapshot?.design.experience?.javascript).toBe("let dancing = true;");
  expect(mock.charge).toHaveBeenCalledTimes(2);
});
it("compacts oversized history while retaining exact files, task and working notes", async () => {
  const state = initial();
  state.messages = [{ role: "assistant", content: "obsolete history" }];
  state.inputTokens = 150000;
  state.files.html = "<main>Must survive</main>";
  state.notes = "Wire keyboard controls";
  response(async () => {});
  const result = await advanceSiteBuild(state, "account");
  const prompt = JSON.stringify(mock.stream.mock.calls[0][0].messages);
  expect(prompt).toContain("Must survive");
  expect(prompt).toContain("Wire keyboard controls");
  expect(prompt).toContain("Keep the dance");
  expect(prompt).not.toContain("obsolete history");
  expect(result.compactions).toBe(1);
});
it("rejects invalid JavaScript at finish and lets the agent repair it", async () => {
  response(async o => {
    await o.tools.write_file.execute({ file: "html", content: "<main>Dance</main>", notes: "" });
    await o.tools.write_file.execute({
      file: "javascript",
      content: "function {",
      notes: "Fix syntax",
    });
    expect(await o.tools.finish.execute({ design: metadata })).toMatchObject({ success: false });
  });
  expect((await advanceSiteBuild(initial(), "account")).snapshot).toBeUndefined();
});
it("does not turn a provider outage into another paid request", async () => {
  mock.stream.mockImplementationOnce(() => ({
    fullStream: (async function* () {
      yield { type: "error", error: new Error("Provider unavailable") };
    })(),
  }));
  await expect(advanceSiteBuild(initial(), "account")).rejects.toThrow("Provider unavailable");
  expect(mock.stream).toHaveBeenCalledOnce();
});
it("continues signed reasoning after a response limit instead of restarting the same request", async () => {
  const reasoning = {
    type: "reasoning",
    text: "",
    providerOptions: { anthropic: { signature: "opaque-signature" } },
  };
  mock.stream.mockReturnValueOnce({
    fullStream: (async function* () {
      yield { type: "finish" };
    })(),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 65536 }),
    finishReason: Promise.resolve("length"),
    response: Promise.resolve({
      messages: [
        {
          role: "assistant",
          content: [
            reasoning,
            { type: "tool-call", toolCallId: "partial", toolName: "write_file", input: {} },
          ],
        },
      ],
    }),
  });
  const next = await advanceSiteBuild(initial(), "account");
  expect(next.messages).toEqual([{ role: "assistant", content: [reasoning] }]);
  response(async () => {});
  await advanceSiteBuild(next, "account");
  expect(JSON.stringify(mock.stream.mock.calls[1][0].messages)).toContain("opaque-signature");
});
it("compacts a provider context rejection without discarding source files", async () => {
  const { APICallError } = await import("ai");
  const state = initial();
  state.messages = [{ role: "assistant", content: "history" }];
  state.files.html = "<main>Saved</main>";
  mock.stream.mockReturnValueOnce({
    fullStream: (async function* () {
      yield {
        type: "error",
        error: new APICallError({
          message: "prompt is too long",
          url: "https://provider.test",
          requestBodyValues: {},
          statusCode: 400,
        }),
      };
    })(),
  });
  const next = await advanceSiteBuild(state, "account");
  expect(next.messages).toEqual([]);
  expect(next.files).toEqual(state.files);
  expect(next.compactions).toBe(1);
});
