import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UIMessage } from "ai";
import { finalizeAbortedAssistantMessage } from "@/lib/chat/finalizeAbortedAssistantMessage";
import { closeOpenToolCalls } from "@/lib/chat/closeOpenToolCalls";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";

vi.mock("@/lib/chat/closeOpenToolCalls", () => ({ closeOpenToolCalls: vi.fn() }));
vi.mock("@/lib/chat/persistAssistantMessage", () => ({ persistAssistantMessage: vi.fn() }));

const CHAT_ID = "chat-1";
const original = { id: "m1", role: "assistant", parts: [] } as unknown as UIMessage;

describe("finalizeAbortedAssistantMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists and returns the closed message when open tool-calls were closed", async () => {
    const closed = {
      id: "m1",
      role: "assistant",
      parts: [{ type: "step-start" }],
    } as unknown as UIMessage;
    vi.mocked(closeOpenToolCalls).mockReturnValue(closed);

    const result = await finalizeAbortedAssistantMessage(CHAT_ID, original);

    expect(closeOpenToolCalls).toHaveBeenCalledWith(original);
    expect(persistAssistantMessage).toHaveBeenCalledWith(CHAT_ID, closed);
    expect(result).toBe(closed);
  });

  it("is a no-op (no persist, returns original) when nothing was open", async () => {
    vi.mocked(closeOpenToolCalls).mockReturnValue(original);

    const result = await finalizeAbortedAssistantMessage(CHAT_ID, original);

    expect(persistAssistantMessage).not.toHaveBeenCalled();
    expect(result).toBe(original);
  });
});
