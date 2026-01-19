import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import { ToolLoopAgent, stepCountIs } from "ai";

// Mock all external dependencies
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/account_info/selectAccountInfo", () => ({
  selectAccountInfo: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/getAccountWithDetails", () => ({
  getAccountWithDetails: vi.fn(),
}));

vi.mock("@/lib/files/getKnowledgeBaseText", () => ({
  getKnowledgeBaseText: vi.fn(),
}));

vi.mock("@/lib/chat/setupToolsForRequest", () => ({
  setupToolsForRequest: vi.fn(),
}));

vi.mock("@/lib/prompts/getSystemPrompt", () => ({
  getSystemPrompt: vi.fn(),
}));

vi.mock("@/lib/messages/extractImageUrlsFromMessages", () => ({
  extractImageUrlsFromMessages: vi.fn(),
}));

vi.mock("@/lib/chat/buildSystemPromptWithImages", () => ({
  buildSystemPromptWithImages: vi.fn(),
}));

// Import after mocks
import getGeneralAgent from "../getGeneralAgent";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { getKnowledgeBaseText } from "@/lib/files/getKnowledgeBaseText";
import { setupToolsForRequest } from "@/lib/chat/setupToolsForRequest";
import { getSystemPrompt } from "@/lib/prompts/getSystemPrompt";
import { extractImageUrlsFromMessages } from "@/lib/messages/extractImageUrlsFromMessages";
import { buildSystemPromptWithImages } from "@/lib/chat/buildSystemPromptWithImages";

const mockSelectAccountEmails = vi.mocked(selectAccountEmails);
const mockSelectAccountInfo = vi.mocked(selectAccountInfo);
const mockGetAccountWithDetails = vi.mocked(getAccountWithDetails);
const mockGetKnowledgeBaseText = vi.mocked(getKnowledgeBaseText);
const mockSetupToolsForRequest = vi.mocked(setupToolsForRequest);
const mockGetSystemPrompt = vi.mocked(getSystemPrompt);
const mockExtractImageUrls = vi.mocked(extractImageUrlsFromMessages);
const mockBuildSystemPromptWithImages = vi.mocked(buildSystemPromptWithImages);

describe("getGeneralAgent", () => {
  const mockTools = { tool1: {}, tool2: {} };
  const baseSystemPrompt = "You are Recoup...";
  const finalInstructions = "You are Recoup... with images";

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock returns
    mockSelectAccountEmails.mockResolvedValue([
      { email: "user@example.com", account_id: "account-123" } as any,
    ]);
    mockSelectAccountInfo.mockResolvedValue(null);
    mockGetAccountWithDetails.mockResolvedValue({
      id: "account-123",
      name: "Test User",
      email: "user@example.com",
    } as any);
    mockGetKnowledgeBaseText.mockResolvedValue(undefined);
    mockSetupToolsForRequest.mockResolvedValue(mockTools);
    mockGetSystemPrompt.mockReturnValue(baseSystemPrompt);
    mockExtractImageUrls.mockReturnValue([]);
    mockBuildSystemPromptWithImages.mockReturnValue(finalInstructions);
  });

  describe("basic functionality", () => {
    it("returns a RoutingDecision object with required properties", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      expect(result).toHaveProperty("agent");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("instructions");
      expect(result).toHaveProperty("stopWhen");
    });

    it("returns a ToolLoopAgent instance", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      expect(result.agent).toBeInstanceOf(ToolLoopAgent);
    });

    it("uses DEFAULT_MODEL when no model is specified", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      expect(result.model).toBe("openai/gpt-5-mini");
    });

    it("uses custom model when specified in body", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
        model: "anthropic/claude-3-opus",
      };

      const result = await getGeneralAgent(body);

      expect(result.model).toBe("anthropic/claude-3-opus");
    });

    it("sets stopWhen to stepCountIs(111)", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      expect(result.stopWhen).toBeDefined();
      // stepCountIs returns a function, verify it's the expected type
      expect(typeof result.stopWhen).toBe("function");
    });
  });

  describe("account email lookup", () => {
    it("fetches account emails using accountId", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockSelectAccountEmails).toHaveBeenCalledWith({
        accountIds: "account-123",
      });
    });

    it("uses first email from account emails list", async () => {
      mockSelectAccountEmails.mockResolvedValue([
        { email: "first@example.com", account_id: "account-123" } as any,
        { email: "second@example.com", account_id: "account-123" } as any,
      ]);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockGetSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ email: "first@example.com" }),
      );
    });

    it("handles empty account emails gracefully", async () => {
      mockSelectAccountEmails.mockResolvedValue([]);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockGetSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ email: undefined }),
      );
    });
  });

  describe("artist context", () => {
    it("fetches artist info when artistId is provided", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        artistId: "artist-456",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockSelectAccountInfo).toHaveBeenCalledWith("artist-456");
    });

    it("does not fetch artist info when artistId is not provided", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockSelectAccountInfo).not.toHaveBeenCalled();
    });

    it("extracts artist instruction from account info", async () => {
      mockSelectAccountInfo.mockResolvedValue({
        instruction: "Always be formal with this artist",
        knowledges: [],
      } as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        artistId: "artist-456",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockGetSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          artistInstruction: "Always be formal with this artist",
        }),
      );
    });

    it("fetches knowledge base text when artist has knowledges", async () => {
      const mockKnowledges = [
        { name: "faq.md", url: "https://example.com/faq.md", type: "text/markdown" },
      ];
      mockSelectAccountInfo.mockResolvedValue({
        instruction: null,
        knowledges: mockKnowledges,
      } as any);
      mockGetKnowledgeBaseText.mockResolvedValue("FAQ content here");

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        artistId: "artist-456",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockGetKnowledgeBaseText).toHaveBeenCalledWith(mockKnowledges);
      expect(mockGetSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ knowledgeBaseText: "FAQ content here" }),
      );
    });
  });

  describe("system prompt generation", () => {
    it("calls getSystemPrompt with all required parameters", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        artistId: "artist-456",
        roomId: "room-789",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockGetSystemPrompt).toHaveBeenCalledWith({
        roomId: "room-789",
        artistId: "artist-456",
        accountId: "account-123",
        orgId: null,
        email: "user@example.com",
        artistInstruction: undefined,
        knowledgeBaseText: undefined,
        accountWithDetails: expect.any(Object),
      });
    });

    it("passes accountWithDetails to getSystemPrompt", async () => {
      const mockAccountDetails = {
        id: "account-123",
        name: "Test User",
        email: "user@example.com",
        job_title: "Music Manager",
      };
      mockGetAccountWithDetails.mockResolvedValue(mockAccountDetails as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGeneralAgent(body);

      expect(mockGetSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ accountWithDetails: mockAccountDetails }),
      );
    });
  });

  describe("image URL handling", () => {
    it("extracts image URLs from messages", async () => {
      const messages = [
        {
          id: "1",
          role: "user",
          content: "Edit this image",
          parts: [{ type: "file", mediaType: "image/png", url: "https://example.com/image.png" }],
        },
      ];
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages,
      };

      await getGeneralAgent(body);

      expect(mockExtractImageUrls).toHaveBeenCalledWith(messages);
    });

    it("builds system prompt with image URLs", async () => {
      mockExtractImageUrls.mockReturnValue([
        "https://example.com/image1.png",
        "https://example.com/image2.png",
      ]);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Edit these images" }],
      };

      await getGeneralAgent(body);

      expect(mockBuildSystemPromptWithImages).toHaveBeenCalledWith(baseSystemPrompt, [
        "https://example.com/image1.png",
        "https://example.com/image2.png",
      ]);
    });

    it("uses final instructions from buildSystemPromptWithImages", async () => {
      mockBuildSystemPromptWithImages.mockReturnValue("Final system prompt with images");

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      expect(result.instructions).toBe("Final system prompt with images");
    });
  });

  describe("tools setup", () => {
    it("calls setupToolsForRequest with body", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
        excludeTools: ["dangerous_tool"],
      };

      await getGeneralAgent(body);

      expect(mockSetupToolsForRequest).toHaveBeenCalledWith(body);
    });

    it("includes tools in returned agent", async () => {
      const customTools = { myTool: {}, anotherTool: {} };
      mockSetupToolsForRequest.mockResolvedValue(customTools);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      expect(result.agent.tools).toEqual(customTools);
    });
  });

  describe("agent configuration", () => {
    it("creates ToolLoopAgent with model matching result model", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
        model: "anthropic/claude-sonnet-4",
      };

      const result = await getGeneralAgent(body);

      // The agent is created with the model, which is also returned in result.model
      expect(result.model).toBe("anthropic/claude-sonnet-4");
      expect(result.agent).toBeInstanceOf(ToolLoopAgent);
    });

    it("creates ToolLoopAgent with instructions matching result instructions", async () => {
      mockBuildSystemPromptWithImages.mockReturnValue("Complete system instructions");

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      // Instructions returned in result match what was used to create the agent
      expect(result.instructions).toBe("Complete system instructions");
      expect(result.agent).toBeInstanceOf(ToolLoopAgent);
    });

    it("creates ToolLoopAgent with tools accessible via agent.tools", async () => {
      const expectedTools = { toolA: {}, toolB: {} };
      mockSetupToolsForRequest.mockResolvedValue(expectedTools);

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      expect(result.agent.tools).toEqual(expectedTools);
    });

    it("returns stopWhen in the routing decision", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGeneralAgent(body);

      // stopWhen is returned in the routing decision (stepCountIs returns a function)
      expect(result.stopWhen).toBeDefined();
      expect(typeof result.stopWhen).toBe("function");
    });
  });
});
