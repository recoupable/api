import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  createPromptSandboxStreamingTool,
  SANDBOX_PROMPT_NOTE,
} from "../createPromptSandboxStreamingTool";

const mockPromptSandboxStreaming = vi.fn();

vi.mock("@/lib/sandbox/promptSandboxStreaming", () => ({
  promptSandboxStreaming: (...args: unknown[]) => mockPromptSandboxStreaming(...args),
}));

// Helper to drain an async iterable into yields + return value
async function drainGenerator(iterable: AsyncIterable<unknown>) {
  const yields: unknown[] = [];
  for await (const value of iterable) {
    yields.push(value);
  }
  return yields;
}

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
    const iterable = tool.execute!(
      { prompt: "say hello" },
      {
        abortSignal: new AbortController().signal,
        toolCallId: "tc_1",
        messages: [],
      },
    ) as AsyncIterable<unknown>;

    const yields = await drainGenerator(iterable);

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
    const iterable = tool.execute!(
      { prompt: "do stuff" },
      {
        abortSignal: new AbortController().signal,
        toolCallId: "tc_2",
        messages: [],
      },
    ) as AsyncIterable<unknown>;

    await drainGenerator(iterable);

    expect(mockPromptSandboxStreaming).toHaveBeenCalledWith({
      accountId: "acc_456",
      apiKey: "key_789",
      prompt: SANDBOX_PROMPT_NOTE + "\n\n" + "do stuff",
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
    const iterable = tool.execute!(
      { prompt: "fail" },
      {
        abortSignal: new AbortController().signal,
        toolCallId: "tc_3",
        messages: [],
      },
    ) as AsyncIterable<unknown>;

    const yields = await drainGenerator(iterable);

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
    expect(tool.inputSchema).toBeDefined();
  });

  describe("sandbox prompt note", () => {
    it("prepends SANDBOX_PROMPT_NOTE to the user prompt", async () => {
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

      const tool = createPromptSandboxStreamingTool("acc_1", "key_1");
      const iterable = tool.execute!(
        { prompt: "update the release" },
        {
          abortSignal: new AbortController().signal,
          toolCallId: "tc_note",
          messages: [],
        },
      ) as AsyncIterable<unknown>;

      await drainGenerator(iterable);

      const calledPrompt = mockPromptSandboxStreaming.mock.calls[0][0].prompt;
      expect(calledPrompt).toContain("push");
      expect(calledPrompt).toContain("main");
      expect(calledPrompt).toContain("orgs");
      expect(calledPrompt).toContain("update the release");
    });

    it("exports SANDBOX_PROMPT_NOTE as a non-empty string", () => {
      expect(typeof SANDBOX_PROMPT_NOTE).toBe("string");
      expect(SANDBOX_PROMPT_NOTE.length).toBeGreaterThan(0);
    });
  });

  describe("description mentions release management", () => {
    it("includes release management as a primary use case", () => {
      const tool = createPromptSandboxStreamingTool("acc_1", "key_1");

      expect(tool.description).toContain("release management");
    });

    it("describes itself as the primary tool", () => {
      const tool = createPromptSandboxStreamingTool("acc_1", "key_1");

      expect(tool.description).toContain("primary tool");
    });

    it("mentions RELEASE.md documents", () => {
      const tool = createPromptSandboxStreamingTool("acc_1", "key_1");

      expect(tool.description).toContain("RELEASE.md");
    });
  });
});
