import { describe, it, expect } from "vitest";
import { getSystemPrompt } from "../getSystemPrompt";

describe("getSystemPrompt", () => {
  describe("basic functionality", () => {
    it("returns a string prompt", () => {
      const result = getSystemPrompt({ accountId: "account-123" });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("includes base system prompt content", () => {
      const result = getSystemPrompt({ accountId: "account-123" });
      expect(result).toContain("Recoup");
      expect(result).toContain("music industry");
    });
  });

  describe("context values section", () => {
    it("includes accountId in context", () => {
      const result = getSystemPrompt({ accountId: "acc-12345" });
      expect(result).toContain("account_id: acc-12345");
    });

    it("shows Unknown for missing accountId", () => {
      const result = getSystemPrompt({ accountId: "" });
      expect(result).toContain("account_id: Unknown");
    });

    it("includes artistId as artist_account_id", () => {
      const result = getSystemPrompt({ accountId: "acc-1", artistId: "artist-789" });
      expect(result).toContain("artist_account_id: artist-789");
    });

    it("includes email in context", () => {
      const result = getSystemPrompt({ accountId: "acc-1", email: "user@example.com" });
      expect(result).toContain("active_account_email: user@example.com");
    });

    it("shows Unknown for missing email", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).toContain("active_account_email: Unknown");
    });

    it("includes roomId as conversation id", () => {
      const result = getSystemPrompt({ accountId: "acc-1", roomId: "room-456" });
      expect(result).toContain("active_conversation_id: room-456");
    });

    it("shows No ID for missing roomId", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).toContain("active_conversation_id: No ID");
    });

    it("includes conversationName", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        conversationName: "Marketing Chat",
      });
      expect(result).toContain("active_conversation_name: Marketing Chat");
    });

    it("defaults conversationName to New conversation", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).toContain("active_conversation_name: New conversation");
    });
  });

  describe("image editing instructions", () => {
    it("includes image editing instructions", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).toContain("**IMAGE EDITING INSTRUCTIONS:**");
    });

    it("includes guidance about which image to edit", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).toContain("WHICH IMAGE TO EDIT");
    });

    it("includes guidance about how to call the tool", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).toContain("HOW TO CALL THE TOOL");
    });
  });

  describe("user context section", () => {
    it("includes user context when accountWithDetails provided", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        accountWithDetails: {
          id: "acc-1",
          name: "John Doe",
          email: "john@example.com",
        } as any,
      });
      expect(result).toContain("-----CURRENT USER CONTEXT-----");
      expect(result).toContain("Name: John Doe");
      expect(result).toContain("Email: john@example.com");
    });

    it("shows Not provided for missing user name", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        accountWithDetails: {
          id: "acc-1",
        } as any,
      });
      expect(result).toContain("Name: Not provided");
    });

    it("includes professional context when available", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        accountWithDetails: {
          id: "acc-1",
          job_title: "Music Manager",
          role_type: "Manager",
          company_name: "Warner Music",
          organization: "Warner Records",
        } as any,
      });
      expect(result).toContain("Professional Context:");
      expect(result).toContain("Job Title: Music Manager");
      expect(result).toContain("Role Type: Manager");
      expect(result).toContain("Company: Warner Music");
      expect(result).toContain("Organization: Warner Records");
    });

    it("omits professional context section if no professional fields", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        accountWithDetails: {
          id: "acc-1",
          name: "John",
        } as any,
      });
      expect(result).not.toContain("Professional Context:");
    });

    it("includes user custom instructions when available", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        accountWithDetails: {
          id: "acc-1",
          instruction: "Always respond in formal English",
        } as any,
      });
      expect(result).toContain("User's Custom Instructions & Preferences:");
      expect(result).toContain("Always respond in formal English");
    });

    it("includes end marker for user context", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        accountWithDetails: { id: "acc-1" } as any,
      });
      expect(result).toContain("-----END USER CONTEXT-----");
    });

    it("uses email from accountWithDetails if available", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        email: "passed@example.com",
        accountWithDetails: {
          id: "acc-1",
          email: "details@example.com",
        } as any,
      });
      expect(result).toContain("Email: details@example.com");
    });

    it("falls back to email param if accountWithDetails email is missing", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        email: "fallback@example.com",
        accountWithDetails: {
          id: "acc-1",
        } as any,
      });
      expect(result).toContain("Email: fallback@example.com");
    });
  });

  describe("artist context section", () => {
    it("includes artist context when artistInstruction provided", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        artistInstruction: "Always mention tour dates",
      });
      expect(result).toContain("-----SELECTED ARTIST/WORKSPACE CONTEXT-----");
      expect(result).toContain("Always mention tour dates");
    });

    it("includes end marker for artist context", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        artistInstruction: "Some instruction",
      });
      expect(result).toContain("-----END ARTIST/WORKSPACE CONTEXT-----");
    });

    it("omits artist context section when no artistInstruction", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).not.toContain("-----SELECTED ARTIST/WORKSPACE CONTEXT-----");
    });
  });

  describe("knowledge base section", () => {
    it("includes knowledge base when knowledgeBaseText provided", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        knowledgeBaseText: "FAQ: What is Recoup?\nAnswer: AI platform for music",
      });
      expect(result).toContain("-----ARTIST/WORKSPACE KNOWLEDGE BASE-----");
      expect(result).toContain("FAQ: What is Recoup?");
    });

    it("includes end marker for knowledge base", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        knowledgeBaseText: "Some knowledge",
      });
      expect(result).toContain("-----END ARTIST/WORKSPACE KNOWLEDGE BASE-----");
    });

    it("omits knowledge base section when no knowledgeBaseText", () => {
      const result = getSystemPrompt({ accountId: "acc-1" });
      expect(result).not.toContain("-----ARTIST/WORKSPACE KNOWLEDGE BASE-----");
    });
  });

  describe("section ordering", () => {
    it("places user context before artist context", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        accountWithDetails: { id: "acc-1", name: "User" } as any,
        artistInstruction: "Artist instructions",
      });

      const userIndex = result.indexOf("CURRENT USER CONTEXT");
      const artistIndex = result.indexOf("SELECTED ARTIST/WORKSPACE");
      expect(userIndex).toBeLessThan(artistIndex);
    });

    it("places artist context before knowledge base", () => {
      const result = getSystemPrompt({
        accountId: "acc-1",
        artistInstruction: "Artist instructions",
        knowledgeBaseText: "Knowledge content",
      });

      const artistIndex = result.indexOf("SELECTED ARTIST/WORKSPACE");
      const kbIndex = result.indexOf("KNOWLEDGE BASE");
      expect(artistIndex).toBeLessThan(kbIndex);
    });
  });
});
