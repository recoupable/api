import { describe, it, expect, vi, beforeEach } from "vitest";
import { compactChat } from "../compactChat";

const mockSelectMemories = vi.fn();
const mockCreateCompactAgent = vi.fn();
const mockAgentGenerate = vi.fn();

vi.mock("@/lib/supabase/memories/selectMemories", () => ({
  default: (...args: unknown[]) => mockSelectMemories(...args),
}));

vi.mock("@/lib/agents/CompactAgent", () => ({
  createCompactAgent: (...args: unknown[]) => mockCreateCompactAgent(...args),
}));

describe("compactChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for agent
    mockCreateCompactAgent.mockReturnValue({
      generate: mockAgentGenerate,
    });
  });

  it("returns empty compacted string when no memories exist", async () => {
    mockSelectMemories.mockResolvedValue([]);

    const result = await compactChat("chat-123");

    expect(result).toEqual({
      chatId: "chat-123",
      compacted: "",
    });
    expect(mockCreateCompactAgent).not.toHaveBeenCalled();
  });

  it("returns empty compacted string when memories is null", async () => {
    mockSelectMemories.mockResolvedValue(null);

    const result = await compactChat("chat-123");

    expect(result).toEqual({
      chatId: "chat-123",
      compacted: "",
    });
    expect(mockCreateCompactAgent).not.toHaveBeenCalled();
  });

  it("generates summary from chat memories using agent", async () => {
    const mockMemories = [
      {
        id: "mem-1",
        room_id: "chat-123",
        content: { role: "user", content: "Hello, how are you?" },
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "mem-2",
        room_id: "chat-123",
        content: { role: "assistant", content: "I'm doing well, thank you!" },
        updated_at: "2024-01-01T00:01:00Z",
      },
    ];

    mockSelectMemories.mockResolvedValue(mockMemories);
    mockAgentGenerate.mockResolvedValue({ text: "A brief greeting exchange." });

    const result = await compactChat("chat-123");

    expect(mockSelectMemories).toHaveBeenCalledWith("chat-123", { ascending: true });
    expect(mockCreateCompactAgent).toHaveBeenCalledWith(undefined);
    expect(mockAgentGenerate).toHaveBeenCalledWith({
      prompt: expect.stringContaining("user: Hello, how are you?"),
    });
    expect(result).toEqual({
      chatId: "chat-123",
      compacted: "A brief greeting exchange.",
    });
  });

  it("uses custom prompt when provided", async () => {
    const mockMemories = [
      {
        id: "mem-1",
        room_id: "chat-123",
        content: { role: "user", content: "Test message" },
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockSelectMemories.mockResolvedValue(mockMemories);
    mockAgentGenerate.mockResolvedValue({ text: "Custom summary." });

    const customPrompt = "Focus only on action items";
    const result = await compactChat("chat-123", customPrompt);

    expect(mockCreateCompactAgent).toHaveBeenCalledWith(customPrompt);
    expect(mockAgentGenerate).toHaveBeenCalledWith({
      prompt: expect.stringContaining("user: Test message"),
    });
    expect(result?.compacted).toBe("Custom summary.");
  });

  it("handles memories with complex content structure", async () => {
    const mockMemories = [
      {
        id: "mem-1",
        room_id: "chat-123",
        content: { nested: { data: "complex" } },
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockSelectMemories.mockResolvedValue(mockMemories);
    mockAgentGenerate.mockResolvedValue({ text: "Summary of complex content." });

    const result = await compactChat("chat-123");

    expect(mockAgentGenerate).toHaveBeenCalled();
    expect(result?.compacted).toBe("Summary of complex content.");
  });
});
