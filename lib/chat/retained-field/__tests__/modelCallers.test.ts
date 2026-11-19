import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { handleSlackChatMessage } from "@/lib/slack/chat/handlers/handleSlackChatMessage";
import { callChatFunctionsWithResult } from "@/lib/evals/callChatFunctionsWithResult";
const mocks = vi.hoisted(() => ({
  memories: vi.fn(),
  setup: vi.fn(),
  key: vi.fn(),
  agent: vi.fn(),
  convert: vi.fn(),
  generate: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/supabase/memories/selectMemories", () => ({ default: mocks.memories }));
vi.mock("@/lib/chat/setupConversation", () => ({ setupConversation: mocks.setup }));
vi.mock("@/lib/keys/getApiKeyDetails", () => ({ getApiKeyDetails: mocks.key }));
vi.mock("@/lib/chat/saveChatCompletion", () => ({ saveChatCompletion: mocks.save }));
vi.mock("@/lib/agents/generalAgent/getGeneralAgent", () => ({ default: mocks.agent }));
vi.mock("@/lib/consts", () => ({
  DEFAULT_MODEL: "synthetic",
  EVAL_ACCOUNT_ID: "eval-actor",
  EVAL_ACCESS_TOKEN: "synthetic",
}));
vi.mock("ai", async original => ({
  ...(await original<typeof import("ai")>()),
  convertToModelMessages: mocks.convert,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("NETWORK FORBIDDEN");
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.key.mockResolvedValue({ accountId: "key-actor" });
  mocks.setup.mockResolvedValue({ roomId: "real-room" });
  mocks.agent.mockResolvedValue({ agent: { tools: {}, generate: mocks.generate } });
  mocks.convert.mockResolvedValue([{ role: "user", content: "safe" }]);
  mocks.generate.mockResolvedValue({ text: "safe answer", steps: [] });
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function thread() {
  return {
    state: Promise.resolve({ status: "idle", roomId: "real-room" } as never),
    post: vi.fn(),
    setState: vi.fn(),
  };
}
it.each(["metadata", "parts"])(
  "Slack rejects retained %s before reconstruction, conversion or generation",
  async location => {
    const message = {
      role: "assistant",
      parts: [{ type: "text", text: "PRIVATE 987654321" }],
      [location]:
        location === "metadata"
          ? { mode: "retained_field" }
          : [{ type: "text", text: "PRIVATE 987654321" }, { type: "data-retained-field-snapshot" }],
    };
    mocks.memories.mockResolvedValue([{ id: "saved", content: message }]);
    const target = thread();
    await handleSlackChatMessage(target, "ordinary prompt");
    expect(mocks.agent).not.toHaveBeenCalled();
    expect(mocks.convert).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(JSON.stringify(target.post.mock.calls)).not.toContain("987654321");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("987654321");
    expect(target.setState).toHaveBeenLastCalledWith({
      status: "idle",
      prompt: "ordinary prompt",
      roomId: "real-room",
    });
  },
);
it("Slack preserves the server key account and ordinary unmarked generation", async () => {
  mocks.memories.mockResolvedValue([
    { id: "saved", content: { role: "assistant", parts: [{ type: "text", text: "safe" }] } },
  ]);
  await handleSlackChatMessage(thread(), "ordinary prompt");
  expect(mocks.agent).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: "key-actor", roomId: "real-room" }),
  );
  expect(mocks.generate).toHaveBeenCalledTimes(1);
});
it("evaluation caller cannot send an unexpected marked converted result to generate", async () => {
  mocks.convert.mockResolvedValue([
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          output: { type: "json", value: { mode: "retained_field", amount: 987654321 } },
        },
      ],
    },
  ]);
  await expect(callChatFunctionsWithResult("ordinary prompt")).rejects.toThrow(
    "Retained-field model input unavailable",
  );
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("evaluation caller preserves ordinary unmarked behavior", async () => {
  await expect(callChatFunctionsWithResult("ordinary prompt")).resolves.toMatchObject({
    text: "safe answer",
  });
  expect(mocks.generate).toHaveBeenCalledTimes(1);
});
