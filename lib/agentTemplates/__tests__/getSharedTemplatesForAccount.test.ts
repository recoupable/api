import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSharedTemplatesForAccount } from "../getSharedTemplatesForAccount";

const mockSelectAgentTemplateShares = vi.fn();

vi.mock("@/lib/supabase/agent_template_shares/selectAgentTemplateShares", () => ({
  default: (...args: unknown[]) => mockSelectAgentTemplateShares(...args),
}));

describe("getSharedTemplatesForAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no shared templates exist", async () => {
    mockSelectAgentTemplateShares.mockResolvedValue([]);

    const result = await getSharedTemplatesForAccount("account-123");

    expect(mockSelectAgentTemplateShares).toHaveBeenCalledWith({
      userId: "account-123",
      includeTemplates: true,
    });
    expect(result).toEqual([]);
  });

  it("returns templates for account with shared templates", async () => {
    const mockSharedData = [
      {
        template_id: "tmpl-1",
        user_id: "account-123",
        created_at: "2024-01-01T00:00:00Z",
        templates: {
          id: "tmpl-1",
          title: "Shared Template",
          description: "A shared template",
          prompt: "Test prompt",
          tags: ["tag1"],
          creator: "other-user",
          is_private: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
        },
      },
    ];
    mockSelectAgentTemplateShares.mockResolvedValue(mockSharedData);

    const result = await getSharedTemplatesForAccount("account-123");

    expect(mockSelectAgentTemplateShares).toHaveBeenCalledWith({
      userId: "account-123",
      includeTemplates: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tmpl-1");
    expect(result[0].title).toBe("Shared Template");
  });

  it("handles multiple templates and deduplicates by ID", async () => {
    const mockSharedData = [
      {
        template_id: "tmpl-1",
        user_id: "account-123",
        created_at: "2024-01-01T00:00:00Z",
        templates: {
          id: "tmpl-1",
          title: "Template 1",
          description: "First template",
          prompt: "Prompt 1",
          tags: [],
          creator: "user-a",
          is_private: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
        },
      },
      {
        template_id: "tmpl-1",
        user_id: "account-123",
        created_at: "2024-01-01T00:00:00Z",
        templates: {
          id: "tmpl-1", // Duplicate
          title: "Template 1",
          description: "First template",
          prompt: "Prompt 1",
          tags: [],
          creator: "user-a",
          is_private: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
        },
      },
      {
        template_id: "tmpl-2",
        user_id: "account-123",
        created_at: "2024-01-02T00:00:00Z",
        templates: {
          id: "tmpl-2",
          title: "Template 2",
          description: "Second template",
          prompt: "Prompt 2",
          tags: [],
          creator: "user-b",
          is_private: false,
          created_at: "2024-01-02T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
          favorites_count: 5,
        },
      },
    ];
    mockSelectAgentTemplateShares.mockResolvedValue(mockSharedData);

    const result = await getSharedTemplatesForAccount("account-123");

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["tmpl-1", "tmpl-2"]);
  });

  it("handles templates as array within share", async () => {
    const mockSharedData = [
      {
        template_id: "tmpl-1",
        user_id: "account-123",
        created_at: "2024-01-01T00:00:00Z",
        templates: [
          {
            id: "tmpl-1",
            title: "Template 1",
            description: "First",
            prompt: "P1",
            tags: [],
            creator: "u1",
            is_private: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            favorites_count: 0,
          },
          {
            id: "tmpl-2",
            title: "Template 2",
            description: "Second",
            prompt: "P2",
            tags: [],
            creator: "u2",
            is_private: false,
            created_at: "2024-01-02T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
            favorites_count: 3,
          },
        ],
      },
    ];
    mockSelectAgentTemplateShares.mockResolvedValue(mockSharedData);

    const result = await getSharedTemplatesForAccount("account-123");

    expect(result).toHaveLength(2);
  });

  it("throws error when selectAgentTemplateShares fails", async () => {
    const mockError = { message: "Database connection failed" };
    mockSelectAgentTemplateShares.mockRejectedValue(mockError);

    await expect(getSharedTemplatesForAccount("account-123")).rejects.toEqual(
      mockError,
    );
  });

  it("skips null or undefined share entries", async () => {
    const mockSharedData = [
      null,
      undefined,
      { template_id: "x", user_id: "y", created_at: "z", templates: null },
      {
        template_id: "tmpl-1",
        user_id: "account-123",
        created_at: "2024-01-01T00:00:00Z",
        templates: {
          id: "tmpl-1",
          title: "Valid Template",
          description: "A valid template",
          prompt: "Valid prompt",
          tags: [],
          creator: "user-1",
          is_private: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
        },
      },
    ];
    mockSelectAgentTemplateShares.mockResolvedValue(mockSharedData);

    const result = await getSharedTemplatesForAccount("account-123");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("tmpl-1");
  });
});
