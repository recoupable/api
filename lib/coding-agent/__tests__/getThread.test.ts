import { describe, it, expect, vi } from "vitest";

vi.mock("chat", () => ({
  ThreadImpl: vi.fn().mockImplementation((config: Record<string, unknown>) => config),
}));

describe("getThread", () => {
  it("parses adapter name and channel ID from thread ID", async () => {
    const { getThread } = await import("../getThread");
    const { ThreadImpl } = await import("chat");

    getThread("slack:C123:1234567890.123456");

    expect(ThreadImpl).toHaveBeenCalledWith({
      adapterName: "slack",
      id: "slack:C123:1234567890.123456",
      channelId: "slack:C123",
    });
  });
});
