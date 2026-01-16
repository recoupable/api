import { describe, it, expect, vi, beforeEach } from "vitest";

import selectAgentTemplateShares from "../selectAgentTemplateShares";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectAgentTemplateShares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn });
  });

  it("returns empty array when templateIds is empty", async () => {
    const result = await selectAgentTemplateShares({ templateIds: [] });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns empty array when templateIds is not provided", async () => {
    const result = await selectAgentTemplateShares({});

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns shares for given template IDs", async () => {
    const mockShares = [
      { template_id: "tmpl-1", user_id: "user-1", created_at: "2024-01-01T00:00:00Z" },
      { template_id: "tmpl-1", user_id: "user-2", created_at: "2024-01-02T00:00:00Z" },
      { template_id: "tmpl-2", user_id: "user-1", created_at: "2024-01-03T00:00:00Z" },
    ];
    mockIn.mockResolvedValue({ data: mockShares, error: null });

    const result = await selectAgentTemplateShares({
      templateIds: ["tmpl-1", "tmpl-2"],
    });

    expect(mockFrom).toHaveBeenCalledWith("agent_template_shares");
    expect(mockSelect).toHaveBeenCalledWith("template_id, user_id, created_at");
    expect(mockIn).toHaveBeenCalledWith("template_id", ["tmpl-1", "tmpl-2"]);
    expect(result).toEqual(mockShares);
  });

  it("throws error when database query fails", async () => {
    const mockError = { message: "Database connection failed" };
    mockIn.mockResolvedValue({ data: null, error: mockError });

    await expect(selectAgentTemplateShares({ templateIds: ["tmpl-1"] })).rejects.toEqual(mockError);
  });

  it("returns empty array when data is null but no error", async () => {
    mockIn.mockResolvedValue({ data: null, error: null });

    const result = await selectAgentTemplateShares({
      templateIds: ["tmpl-1"],
    });

    expect(result).toEqual([]);
  });
});
