import { describe, it, expect, vi, beforeEach } from "vitest";

import { createPromptSandboxStreamingTool } from "../createPromptSandboxStreamingTool";

const mockPromptSandboxStreaming = vi.fn();

vi.mock("@/lib/sandbox/promptSandboxStreaming", () => ({
  promptSandboxStreaming: (...args: unknown[]) =>
    mockPromptSandboxStreaming(...args),
}));

describe("createPromptSandboxStreamingTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields booting → streaming → complete statuses in order", async () => {
    const finalResult = {
      sandboxId: "sbx_123",
      stdout: "Hello world",
      stderr: "",
      exitCode: 0,
      created: false,
    };

    async function* fakeStreaming() {
      yield { data: "Hello ", stream: "stdout" as const };
      yield { data: "world", stream: "stdout" as const };
      return finalResult;
    }

    mockPromptSandboxStreaming.mockReturnValue(fakeStreaming());

    const tool = createPromptSandboxStreamingTool("acc_123", "api-key-123");
    const gen = tool.execute!({ prompt: "say hello" }, {
      abortSignal: new AbortController().signal,
      toolCallId: "tc_1",
      messages: [],
    });

    const yields: unknown[] = [];
    let returnValue;

    while (true) {
      const { value, done } = await gen.next();
      if (done) {
        returnValue = value;
        break;
      }
      yields.push(value);
    }

    // First yield: booting
    expect(yields[0]).toEqual({
      status: "booting",
      output: "",
    });

    // Middle yields: streaming with accumulated stdout
    expect(yields[1]).toEqual({
      status: "streaming",
      output: "Hello ",
    });
    expect(yields[2]).toEqual({
      status: "streaming",
      output: "Hello world",
    });

    // Last yield: complete
    expect(yields[3]).toEqual({
      status: "complete",
      output: "Hello world",
      stderr: "",
      exitCode: 0,
    });

    // Return value for outer LLM
    expect(returnValue).toEqual(finalResult);
  });

  it("passes accountId, apiKey, and prompt to promptSandboxStreaming", async () => {
    async function* fakeStreaming() {
      return {
        sandboxId: "sbx_123",
        stdout: "",
        stderr: "",
        exitCode: 0,
        created: false,
      };
    }

    mockPromptSandboxStreaming.mockReturnValue(fakeStreaming());

    const tool = createPromptSandboxStreamingTool("acc_456", "key_789");
    const gen = tool.execute!({ prompt: "do stuff" }, {
      abortSignal: new AbortController().signal,
      toolCallId: "tc_2",
      messages: [],
    });

    // Drain the generator
    while (true) {
      const { done } = await gen.next();
      if (done) break;
    }

    expect(mockPromptSandboxStreaming).toHaveBeenCalledWith({
      accountId: "acc_456",
      apiKey: "key_789",
      prompt: "do stuff",
      abortSignal: expect.any(AbortSignal),
    });
  });

  it("yields only stderr chunks in streaming status", async () => {
    async function* fakeStreaming() {
      yield { data: "warning!", stream: "stderr" as const };
      return {
        sandboxId: "sbx_123",
        stdout: "",
        stderr: "warning!",
        exitCode: 1,
        created: false,
      };
    }

    mockPromptSandboxStreaming.mockReturnValue(fakeStreaming());

    const tool = createPromptSandboxStreamingTool("acc_1", "key_1");
    const gen = tool.execute!({ prompt: "fail" }, {
      abortSignal: new AbortController().signal,
      toolCallId: "tc_3",
      messages: [],
    });

    const yields: unknown[] = [];
    while (true) {
      const { value, done } = await gen.next();
      if (done) break;
      yields.push(value);
    }

    // booting
    expect(yields[0]).toEqual({ status: "booting", output: "" });

    // streaming — stderr doesn't change output (only stdout does)
    expect(yields[1]).toEqual({ status: "streaming", output: "" });

    // complete — stderr is included
    expect(yields[2]).toEqual({
      status: "complete",
      output: "",
      stderr: "warning!",
      exitCode: 1,
    });
  });

  it("has the correct tool description and input schema", () => {
    const tool = createPromptSandboxStreamingTool("acc_1", "key_1");

    expect(tool.description).toContain("sandbox");
    expect(tool.parameters).toBeDefined();
  });
});
