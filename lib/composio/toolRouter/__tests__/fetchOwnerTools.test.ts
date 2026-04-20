import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOwnerTools } from "../fetchOwnerTools";

describe("fetchOwnerTools", () => {
  const mockGet = vi.fn();
  const composio = { tools: { get: mockGet } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty object when ownerId is undefined", async () => {
    const result = await fetchOwnerTools({
      composio,
      ownerId: undefined,
      toolkits: ["tiktok"],
      label: "artist",
      limit: 1000,
    });

    expect(result).toEqual({});
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns an empty object when toolkits is empty", async () => {
    const result = await fetchOwnerTools({
      composio,
      ownerId: "owner-1",
      toolkits: [],
      label: "shared",
      limit: 1000,
    });

    expect(result).toEqual({});
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("forwards ownerId, toolkits, and limit to composio.tools.get", async () => {
    mockGet.mockResolvedValue({ TOOL_A: {} });

    const result = await fetchOwnerTools({
      composio,
      ownerId: "owner-1",
      toolkits: ["tiktok", "instagram"],
      label: "artist",
      limit: 500,
    });

    expect(mockGet).toHaveBeenCalledWith("owner-1", {
      toolkits: ["tiktok", "instagram"],
      limit: 500,
    });
    expect(result).toEqual({ TOOL_A: {} });
  });

  it("logs and returns empty object when composio.tools.get rejects", async () => {
    mockGet.mockRejectedValue(new Error("upstream down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchOwnerTools({
      composio,
      ownerId: "owner-1",
      toolkits: ["googledocs"],
      label: "shared",
      limit: 1000,
    });

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith("Composio shared tools unavailable:", "upstream down");
    warn.mockRestore();
  });
});
