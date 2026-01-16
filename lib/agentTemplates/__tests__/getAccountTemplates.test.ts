import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAccountTemplates } from "../getAccountTemplates";

import { listAgentTemplatesForUser } from "../listAgentTemplatesForUser";
import { getSharedTemplatesForAccount } from "../getSharedTemplatesForAccount";
import selectAgentTemplateFavorites from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";

vi.mock("../listAgentTemplatesForUser", () => ({
  listAgentTemplatesForUser: vi.fn(),
}));

vi.mock("../getSharedTemplatesForAccount", () => ({
  getSharedTemplatesForAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites", () => ({
  default: vi.fn(),
}));

describe("getAccountTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("with authenticated user", () => {
    it("returns owned, public, and shared templates combined", async () => {
      const ownedTemplates = [
        {
          id: "template-1",
          title: "Owned Template",
          description: "My template",
          prompt: "prompt",
          tags: [],
          creator: "user-123",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
        },
      ];

      const sharedTemplates = [
        {
          id: "template-2",
          title: "Shared Template",
          description: "Shared with me",
          prompt: "prompt",
          tags: [],
          creator: "other-user",
          is_private: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
        },
      ];

      vi.mocked(listAgentTemplatesForUser).mockResolvedValue(ownedTemplates);
      vi.mocked(getSharedTemplatesForAccount).mockResolvedValue(sharedTemplates);
      vi.mocked(selectAgentTemplateFavorites).mockResolvedValue([
        { template_id: "template-1", user_id: "user-123", created_at: null },
      ]);

      const result = await getAccountTemplates("user-123");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("template-1");
      expect(result[0].is_favourite).toBe(true);
      expect(result[1].id).toBe("template-2");
      expect(result[1].is_favourite).toBe(false);
    });

    it("deduplicates templates that appear in both owned and shared", async () => {
      const ownedTemplate = {
        id: "template-1",
        title: "Template",
        description: "desc",
        prompt: "prompt",
        tags: [],
        creator: "user-123",
        is_private: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        favorites_count: 0,
      };

      vi.mocked(listAgentTemplatesForUser).mockResolvedValue([ownedTemplate]);
      vi.mocked(getSharedTemplatesForAccount).mockResolvedValue([ownedTemplate]);
      vi.mocked(selectAgentTemplateFavorites).mockResolvedValue([]);

      const result = await getAccountTemplates("user-123");

      expect(result).toHaveLength(1);
    });

    it("marks favorited templates correctly", async () => {
      const templates = [
        {
          id: "template-1",
          title: "Template 1",
          description: "desc",
          prompt: "prompt",
          tags: [],
          creator: "user-123",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 5,
        },
        {
          id: "template-2",
          title: "Template 2",
          description: "desc",
          prompt: "prompt",
          tags: [],
          creator: "user-123",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 0,
        },
      ];

      vi.mocked(listAgentTemplatesForUser).mockResolvedValue(templates);
      vi.mocked(getSharedTemplatesForAccount).mockResolvedValue([]);
      vi.mocked(selectAgentTemplateFavorites).mockResolvedValue([
        { template_id: "template-1", user_id: "user-123", created_at: null },
      ]);

      const result = await getAccountTemplates("user-123");

      expect(result[0].is_favourite).toBe(true);
      expect(result[1].is_favourite).toBe(false);
    });
  });

  describe("with anonymous user (null userId)", () => {
    it("returns only public templates with is_favourite false", async () => {
      const publicTemplates = [
        {
          id: "public-1",
          title: "Public Template",
          description: "desc",
          prompt: "prompt",
          tags: [],
          creator: "someone",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 10,
        },
      ];

      vi.mocked(listAgentTemplatesForUser).mockResolvedValue(publicTemplates);

      const result = await getAccountTemplates(null);

      expect(result).toHaveLength(1);
      expect(result[0].is_favourite).toBe(false);
      expect(listAgentTemplatesForUser).toHaveBeenCalledWith(null);
      expect(getSharedTemplatesForAccount).not.toHaveBeenCalled();
      expect(selectAgentTemplateFavorites).not.toHaveBeenCalled();
    });

    it("returns only public templates when userId is undefined", async () => {
      const publicTemplates = [
        {
          id: "public-1",
          title: "Public Template",
          description: "desc",
          prompt: "prompt",
          tags: [],
          creator: "someone",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 10,
        },
      ];

      vi.mocked(listAgentTemplatesForUser).mockResolvedValue(publicTemplates);

      const result = await getAccountTemplates(undefined);

      expect(result).toHaveLength(1);
      expect(result[0].is_favourite).toBe(false);
    });

    it("returns only public templates when userId is string 'undefined'", async () => {
      const publicTemplates = [
        {
          id: "public-1",
          title: "Public Template",
          description: "desc",
          prompt: "prompt",
          tags: [],
          creator: "someone",
          is_private: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          favorites_count: 10,
        },
      ];

      vi.mocked(listAgentTemplatesForUser).mockResolvedValue(publicTemplates);

      const result = await getAccountTemplates("undefined");

      expect(result).toHaveLength(1);
      expect(result[0].is_favourite).toBe(false);
    });
  });
});
