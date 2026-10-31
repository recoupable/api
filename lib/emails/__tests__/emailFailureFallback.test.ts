import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { processAndSendEmail } from "../processAndSendEmail";
import { sendEmailHandler } from "../sendEmailHandler";
import { registerSendEmailTool } from "@/lib/mcp/tools/registerSendEmailTool";

const { send, validate, logAttempt } = vi.hoisted(() => ({
  send: vi.fn(),
  validate: vi.fn(),
  logAttempt: vi.fn(),
}));

vi.mock("@/lib/emails/client", () => ({
  getResendClient: () => ({ emails: { send } }),
}));
vi.mock("@/lib/supabase/rooms/selectRoomWithArtist", () => ({
  selectRoomWithArtist: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/emails/validateSendEmailBody", () => ({
  validateSendEmailBody: validate,
}));
vi.mock("@/lib/emails/logEmailAttempt", () => ({
  logEmailAttempt: logAttempt,
}));

const input = {
  to: ["recipient-one@example.test", "recipient-two@example.test"],
  cc: ["copy@example.test"],
  subject: "Synthetic failure",
  text: "Synthetic body",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  send.mockResolvedValue({
    data: null,
    error: { message: "Synthetic provider failure", name: "validation_error" },
  });
  logAttempt.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("email failure fallback through the real Resend adapter", () => {
  it.each([{ to: ["single@example.test"] }, { to: input.to }])(
    "does not add recipient addresses to the fallback for %j",
    async ({ to }) => {
      const result = await processAndSendEmail({ ...input, to });

      expect(result).toEqual({ success: false, error: "Failed to send email." });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ to, cc: input.cc }), undefined);
    },
  );

  it("returns the same generic fallback from the REST handler and logs the attempt once", async () => {
    const rawBody = JSON.stringify(input);
    validate.mockResolvedValue({
      rawBody,
      data: { ...input, accountId: "synthetic-account" },
    });
    const response = await sendEmailHandler(
      new NextRequest("https://example.test/api/emails", {
        method: "POST",
        body: rawBody,
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Failed to send email.",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(logAttempt).toHaveBeenCalledExactlyOnceWith({
      rawBody,
      status: "send_failed",
      accountId: "synthetic-account",
      chatId: undefined,
    });
  });

  it("returns the same generic fallback from the registered MCP callback", async () => {
    const registerTool = vi.fn();
    registerSendEmailTool({ registerTool } as unknown as McpServer);
    const callback = registerTool.mock.calls[0][2];

    const result = await callback(input);

    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({ success: false, message: "Failed to send email." }),
      },
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(logAttempt).not.toHaveBeenCalled();
  });

  it("preserves successful delivery fields and recipient confirmation", async () => {
    send.mockResolvedValue({ data: { id: "synthetic-email" }, error: null });

    const result = await processAndSendEmail(input);

    expect(result).toMatchObject({ success: true, id: "synthetic-email" });
    if (result.success) {
      for (const address of [...input.to, ...input.cc]) {
        expect(result.message).toContain(address);
      }
    }
    expect(send).toHaveBeenCalledTimes(1);
  });
});
