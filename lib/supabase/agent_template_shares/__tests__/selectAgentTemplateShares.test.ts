import { describe, it, expect, vi, beforeEach } from "vitest";

import selectAgentTemplateShares from "../selectAgentTemplateShares";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectAgentTemplateShares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn, eq: mockEq });
    mockIn.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ in: mockIn });
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

  describe("userId filtering", () => {
    it("returns shares for given userId", async () => {
      const mockShares = [
        { template_id: "tmpl-1", user_id: "user-1", created_at: "2024-01-01T00:00:00Z" },
        { template_id: "tmpl-2", user_id: "user-1", created_at: "2024-01-03T00:00:00Z" },
      ];
      mockEq.mockResolvedValue({ data: mockShares, error: null });

      const result = await selectAgentTemplateShares({
        userId: "user-1",
      });

      expect(mockFrom).toHaveBeenCalledWith("agent_template_shares");
      expect(mockSelect).toHaveBeenCalledWith("template_id, user_id, created_at");
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(result).toEqual(mockShares);
    });

    it("returns empty array when userId is not provided and no templateIds", async () => {
      const result = await selectAgentTemplateShares({});

      expect(mockFrom).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("combines userId and templateIds filters", async () => {
      const mockShares = [
        { template_id: "tmpl-1", user_id: "user-1", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockEq.mockResolvedValue({ data: mockShares, error: null });

      const result = await selectAgentTemplateShares({
        userId: "user-1",
        templateIds: ["tmpl-1", "tmpl-2"],
      });

      expect(mockFrom).toHaveBeenCalledWith("agent_template_shares");
      expect(mockIn).toHaveBeenCalledWith("template_id", ["tmpl-1", "tmpl-2"]);
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(result).toEqual(mockShares);
    });

    it("throws error when userId query fails", async () => {
      const mockError = { message: "Database connection failed" };
      mockEq.mockResolvedValue({ data: null, error: mockError });

      await expect(
        selectAgentTemplateShares({ userId: "user-1" })
      ).rejects.toEqual(mockError);
    });
  });

  describe("includeTemplates option", () => {
    it("returns shares with joined template data when includeTemplates is true", async () => {
      const mockSharesWithTemplates = [
        {
          template_id: "tmpl-1",
          user_id: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          templates: {
            id: "tmpl-1",
            title: "Template 1",
            description: "Description 1",
            prompt: "Prompt 1",
            tags: ["tag1"],
            creator: "creator-1",
            is_private: true,
            created_at: "2024-01-01T00:00:00Z",
            favorites_count: 5,
            updated_at: "2024-01-01T00:00:00Z",
          },
        },
      ];
      mockEq.mockResolvedValue({ data: mockSharesWithTemplates, error: null });

      const result = await selectAgentTemplateShares({
        userId: "user-1",
        includeTemplates: true,
      });

      expect(mockFrom).toHaveBeenCalledWith("agent_template_shares");
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining("templates:agent_templates")
      );
      expect(result).toEqual(mockSharesWithTemplates);
    });

    it("uses standard select when includeTemplates is false", async () => {
      const mockShares = [
        { template_id: "tmpl-1", user_id: "user-1", created_at: "2024-01-01T00:00:00Z" },
      ];
      mockEq.mockResolvedValue({ data: mockShares, error: null });

      await selectAgentTemplateShares({
        userId: "user-1",
        includeTemplates: false,
      });

      expect(mockSelect).toHaveBeenCalledWith("template_id, user_id, created_at");
    });
  });
});
