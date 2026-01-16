import { describe, it, expect, vi, beforeEach } from "vitest";

import insertAgentTemplateFavorite from "../insertAgentTemplateFavorite";

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("insertAgentTemplateFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it("inserts a favorite and returns success", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { template_id: "tmpl-1" },
      error: null,
    });

    const result = await insertAgentTemplateFavorite({
      templateId: "tmpl-1",
      userId: "user-1",
    });

    expect(mockFrom).toHaveBeenCalledWith("agent_template_favorites");
    expect(mockInsert).toHaveBeenCalledWith({
      template_id: "tmpl-1",
      user_id: "user-1",
    });
    expect(mockSelect).toHaveBeenCalledWith("template_id");
    expect(mockMaybeSingle).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("returns success when favorite already exists (duplicate key error)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const result = await insertAgentTemplateFavorite({
      templateId: "tmpl-1",
      userId: "user-1",
    });

    expect(result).toEqual({ success: true });
  });

  it("throws error when database operation fails with non-duplicate error", async () => {
    const mockError = { code: "42P01", message: "relation does not exist" };
    mockMaybeSingle.mockResolvedValue({ data: null, error: mockError });

    await expect(
      insertAgentTemplateFavorite({
        templateId: "tmpl-1",
        userId: "user-1",
      })
    ).rejects.toEqual(mockError);
  });

  it("throws error when database connection fails", async () => {
    const mockError = { code: "08006", message: "connection_failure" };
    mockMaybeSingle.mockResolvedValue({ data: null, error: mockError });

    await expect(
      insertAgentTemplateFavorite({
        templateId: "tmpl-1",
        userId: "user-1",
      })
    ).rejects.toEqual(mockError);
  });

  it("handles different template and user IDs correctly", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { template_id: "different-tmpl" },
      error: null,
    });

    const result = await insertAgentTemplateFavorite({
      templateId: "different-tmpl",
      userId: "different-user",
    });

    expect(mockInsert).toHaveBeenCalledWith({
      template_id: "different-tmpl",
      user_id: "different-user",
    });
    expect(result).toEqual({ success: true });
  });
});
