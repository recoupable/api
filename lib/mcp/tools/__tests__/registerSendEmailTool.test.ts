import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSendEmailTool } from "../registerSendEmailTool";

const mockProcessAndSendEmail = vi.fn();

vi.mock("@/lib/emails/processAndSendEmail", () => ({
  processAndSendEmail: (...args: unknown[]) => mockProcessAndSendEmail(...args),
}));

describe("registerSendEmailTool", () => {
  let mockServer: McpServer;
  let registeredHandler: (args: unknown) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        registeredHandler = handler;
      }),
    } as unknown as McpServer;

    registerSendEmailTool(mockServer);
  });

  it("registers the send_email tool", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "send_email",
      expect.objectContaining({
        description: expect.stringContaining("Send an email using the Resend API"),
      }),
      expect.any(Function),
    );
  });

  it("returns success when email is sent successfully", async () => {
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message: "Email sent successfully from Agent by Recoup <agent@recoupable.com> to test@example.com. CC: none.",
      id: "email-123",
    });

    const result = await registeredHandler({
      to: ["test@example.com"],
      subject: "Test Subject",
      text: "Test body",
    });

    expect(mockProcessAndSendEmail).toHaveBeenCalledWith({
      to: ["test@example.com"],
      subject: "Test Subject",
      text: "Test body",
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Email sent successfully"),
        },
      ],
    });
  });

  it("passes CC addresses through to processAndSendEmail", async () => {
    mockProcessAndSendEmail.mockResolvedValue({
      success: true,
      message: "Email sent successfully.",
      id: "email-123",
    });

    await registeredHandler({
      to: ["test@example.com"],
      cc: ["cc@example.com"],
      subject: "Test Subject",
    });

    expect(mockProcessAndSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: ["cc@example.com"],
      }),
    );
  });

  it("returns error when processAndSendEmail fails", async () => {
    mockProcessAndSendEmail.mockResolvedValue({
      success: false,
      error: "Rate limited",
    });

    const result = await registeredHandler({
      to: ["test@example.com"],
      subject: "Test Subject",
    });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: expect.stringContaining("Rate limited"),
        },
      ],
    });
  });
});
