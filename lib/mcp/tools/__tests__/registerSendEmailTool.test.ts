import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSendEmailTool } from "../registerSendEmailTool";
import { NextResponse } from "next/server";

const mockSendEmailWithResend = vi.fn();
const mockSelectRoomWithArtist = vi.fn();

vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...args: unknown[]) => mockSendEmailWithResend(...args),
}));

vi.mock("@/lib/supabase/rooms/selectRoomWithArtist", () => ({
  selectRoomWithArtist: (...args: unknown[]) => mockSelectRoomWithArtist(...args),
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
    mockSendEmailWithResend.mockResolvedValue({ id: "email-123" });

    const result = await registeredHandler({
      to: ["test@example.com"],
      subject: "Test Subject",
      text: "Test body",
    });

    expect(mockSendEmailWithResend).toHaveBeenCalledWith({
      from: "Agent by Recoup <agent@recoupable.com>",
      to: ["test@example.com"],
      cc: undefined,
      subject: "Test Subject",
      html: expect.stringMatching(/Test body.*you can reply directly to this email/s),
      headers: {},
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

  it("includes CC addresses when provided", async () => {
    mockSendEmailWithResend.mockResolvedValue({ id: "email-123" });

    await registeredHandler({
      to: ["test@example.com"],
      cc: ["cc@example.com"],
      subject: "Test Subject",
    });

    expect(mockSendEmailWithResend).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: ["cc@example.com"],
      }),
    );
  });

  it("returns error when sendEmailWithResend returns NextResponse", async () => {
    const errorResponse = NextResponse.json({ error: { message: "Rate limited" } }, { status: 429 });
    mockSendEmailWithResend.mockResolvedValue(errorResponse);

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
