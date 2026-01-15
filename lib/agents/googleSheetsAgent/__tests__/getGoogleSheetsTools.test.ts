import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";

// Mock external dependencies
vi.mock("@/lib/composio/client", () => ({
  getComposioClient: vi.fn(),
}));

vi.mock("@/lib/composio/googleSheets/getConnectedAccount", () => ({
  default: vi.fn(),
  GOOGLE_SHEETS_TOOLKIT_SLUG: "GOOGLESHEETS",
}));

vi.mock("@/lib/messages/getLatestUserMessageText", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/composio/tools/googleSheetsLoginTool", () => ({
  default: { description: "Login to Google Sheets", parameters: {} },
}));

// Import after mocks
import getGoogleSheetsTools from "../getGoogleSheetsTools";
import { getComposioClient } from "@/lib/composio/client";
import getConnectedAccount from "@/lib/composio/googleSheets/getConnectedAccount";
import getLatestUserMessageText from "@/lib/messages/getLatestUserMessageText";

const mockGetComposioClient = vi.mocked(getComposioClient);
const mockGetConnectedAccount = vi.mocked(getConnectedAccount);
const mockGetLatestUserMessageText = vi.mocked(getLatestUserMessageText);

describe("getGoogleSheetsTools", () => {
  const mockGoogleSheetsTools = {
    googlesheets_create: { description: "Create sheet" },
    googlesheets_read: { description: "Read sheet" },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: not authenticated
    mockGetConnectedAccount.mockResolvedValue({
      items: [],
    } as any);

    mockGetLatestUserMessageText.mockReturnValue("Test message");

    mockGetComposioClient.mockReturnValue({
      tools: {
        get: vi.fn().mockResolvedValue(mockGoogleSheetsTools),
      },
    } as any);
  });

  describe("authentication check", () => {
    it("calls getConnectedAccount with accountId", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGoogleSheetsTools(body);

      expect(mockGetConnectedAccount).toHaveBeenCalledWith(
        "account-123",
        expect.any(Object),
      );
    });

    it("passes callback URL with encoded latest user message", async () => {
      mockGetLatestUserMessageText.mockReturnValue("Create a spreadsheet for me");

      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Create a spreadsheet for me" }],
      };

      await getGoogleSheetsTools(body);

      expect(mockGetConnectedAccount).toHaveBeenCalledWith(
        "account-123",
        expect.objectContaining({
          callbackUrl: expect.stringContaining("Create%20a%20spreadsheet%20for%20me"),
        }),
      );
    });

    it("callback URL uses chat.recoupable.com as base", async () => {
      mockGetLatestUserMessageText.mockReturnValue("Test");

      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Test" }],
      };

      await getGoogleSheetsTools(body);

      expect(mockGetConnectedAccount).toHaveBeenCalledWith(
        "account-123",
        expect.objectContaining({
          callbackUrl: expect.stringMatching(/^https:\/\/chat\.recoupable\.com/),
        }),
      );
    });
  });

  describe("when user is authenticated", () => {
    beforeEach(() => {
      mockGetConnectedAccount.mockResolvedValue({
        items: [{ data: { status: "ACTIVE" } }],
      } as any);
    });

    it("returns Google Sheets tools from Composio", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGoogleSheetsTools(body);

      expect(result).toHaveProperty("googlesheets_create");
      expect(result).toHaveProperty("googlesheets_read");
    });

    it("calls composio.tools.get with correct parameters", async () => {
      const mockToolsGet = vi.fn().mockResolvedValue(mockGoogleSheetsTools);
      mockGetComposioClient.mockReturnValue({
        tools: { get: mockToolsGet },
      } as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGoogleSheetsTools(body);

      expect(mockToolsGet).toHaveBeenCalledWith("account-123", {
        toolkits: ["GOOGLESHEETS"],
      });
    });
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      mockGetConnectedAccount.mockResolvedValue({
        items: [],
      } as any);
    });

    it("returns google_sheets_login tool", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGoogleSheetsTools(body);

      expect(result).toHaveProperty("google_sheets_login");
    });

    it("does not call composio.tools.get", async () => {
      const mockToolsGet = vi.fn().mockResolvedValue(mockGoogleSheetsTools);
      mockGetComposioClient.mockReturnValue({
        tools: { get: mockToolsGet },
      } as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await getGoogleSheetsTools(body);

      expect(mockToolsGet).not.toHaveBeenCalled();
    });
  });

  describe("when connection status is not ACTIVE", () => {
    it("returns login tool when status is PENDING", async () => {
      mockGetConnectedAccount.mockResolvedValue({
        items: [{ data: { status: "PENDING" } }],
      } as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGoogleSheetsTools(body);

      expect(result).toHaveProperty("google_sheets_login");
    });

    it("returns login tool when status is EXPIRED", async () => {
      mockGetConnectedAccount.mockResolvedValue({
        items: [{ data: { status: "EXPIRED" } }],
      } as any);

      const body: ChatRequestBody = {
        accountId: "account-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await getGoogleSheetsTools(body);

      expect(result).toHaveProperty("google_sheets_login");
    });
  });

  describe("message text extraction", () => {
    it("extracts text from messages using getLatestUserMessageText", async () => {
      const messages = [
        { id: "1", role: "user", content: "First message" },
        { id: "2", role: "assistant", content: "Response" },
        { id: "3", role: "user", content: "Second message" },
      ];
      const body: ChatRequestBody = {
        accountId: "account-123",
        messages,
      };

      await getGoogleSheetsTools(body);

      expect(mockGetLatestUserMessageText).toHaveBeenCalledWith(messages);
    });
  });
});
