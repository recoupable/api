import { describe, it, expect, vi, beforeEach } from "vitest";
import { taskTool } from "@/lib/agent/tools/taskTool";
import { streamText } from "ai";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, streamText: vi.fn() };
});

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

const ctx = {
  sandbox: { state: { sandboxName: "x" }, workingDirectory: "/sandbox/mono" },
  modelId: "anthropic/claude-haiku-4.5",
};

function makeStreamTextResult(finalText: string) {
  return {
    fullStream: (async function* () {
      // empty — execute only awaits `result.finishReason` + result.response
    })(),
    finishReason: Promise.resolve("stop"),
    response: Promise.resolve({
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: finalText }],
        },
      ],
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(connectVercel).mockResolvedValue({ workingDirectory: "/sandbox/mono" } as never);
});

describe("taskTool.execute", () => {
  it("runs a sub-streamText with the subagent system prompt + task + instructions", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("Task done.") as never);
    const result = (await taskTool.execute!(
      { task: "Find the largest .ts file", instructions: "Use glob and stat to find it" },
      { experimental_context: ctx } as never,
    )) as { success: boolean; summary: string };
    expect(result.success).toBe(true);
    expect(result.summary).toBe("Task done.");
    const args = vi.mocked(streamText).mock.calls[0]?.[0] as Record<string, unknown>;
    // system prompt contains task + instructions so the subagent knows its scope
    expect(args.system).toEqual(expect.stringContaining("Find the largest .ts file"));
    expect(args.system).toEqual(expect.stringContaining("Use glob and stat"));
  });

  it("registers only the executor tool set (no recursion, no task/ask/skill/todo/fetch)", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("done") as never);
    await taskTool.execute!({ task: "x", instructions: "y" }, {
      experimental_context: ctx,
    } as never);
    const args = vi.mocked(streamText).mock.calls[0]?.[0] as { tools: Record<string, unknown> };
    const toolNames = Object.keys(args.tools).sort();
    expect(toolNames).toEqual(["bash", "edit", "glob", "grep", "read", "write"]);
    // Critical: NO task (recursion guard) and NO client-side tools.
    expect(args.tools).not.toHaveProperty("task");
    expect(args.tools).not.toHaveProperty("ask_user_question");
    expect(args.tools).not.toHaveProperty("skill");
    expect(args.tools).not.toHaveProperty("todo_write");
    expect(args.tools).not.toHaveProperty("web_fetch");
  });

  it("uses the modelId from agent context", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("done") as never);
    await taskTool.execute!({ task: "x", instructions: "y" }, {
      experimental_context: { ...ctx, modelId: "anthropic/claude-opus-4.6" },
    } as never);
    const args = vi.mocked(streamText).mock.calls[0]?.[0] as { model: { modelId?: string } };
    // Gateway model objects expose `.modelId`; fall back to the raw model arg.
    const id =
      typeof args.model === "string" ? args.model : (args.model as { modelId?: string }).modelId;
    expect(id).toBe("anthropic/claude-opus-4.6");
  });

  it("returns success:false when no assistant text is in the response", async () => {
    vi.mocked(streamText).mockReturnValue({
      fullStream: (async function* () {})(),
      finishReason: Promise.resolve("stop"),
      response: Promise.resolve({ messages: [] }),
    } as never);
    const result = (await taskTool.execute!({ task: "x", instructions: "y" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; summary: string };
    expect(result.success).toBe(false);
    expect(result.summary).toMatch(/no.*assistant/i);
  });

  it("returns success:false with a descriptive error when streamText throws", async () => {
    vi.mocked(streamText).mockImplementation(() => {
      throw new Error("gateway down");
    });
    const result = (await taskTool.execute!({ task: "x", instructions: "y" }, {
      experimental_context: ctx,
    } as never)) as { success: boolean; error: string };
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/gateway down/);
  });

  it("requires modelId in context (throws when missing)", async () => {
    await expect(
      taskTool.execute!({ task: "x", instructions: "y" }, {
        experimental_context: {
          sandbox: ctx.sandbox /* no modelId */,
        },
      } as never),
    ).rejects.toThrow(/modelId/i);
  });
});
