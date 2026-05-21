import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateChatWorkflowBody } from "@/lib/chat/validateChatWorkflowBody";

const validBody = {
  messages: [{ id: "m-1", role: "user", parts: [{ type: "text", text: "hi" }] }],
  chatId: "11111111-1111-1111-1111-111111111111",
  sessionId: "22222222-2222-2222-2222-222222222222",
};

describe("validateChatWorkflowBody", () => {
  describe("valid input", () => {
    it("accepts the minimum required body", () => {
      const result = validateChatWorkflowBody(validBody);
      expect(result).not.toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) return;
      expect(result.messages).toEqual(validBody.messages);
      expect(result.chatId).toBe(validBody.chatId);
      expect(result.sessionId).toBe(validBody.sessionId);
    });

    it("accepts an optional context.contextLimit integer", () => {
      const result = validateChatWorkflowBody({
        ...validBody,
        context: { contextLimit: 50 },
      });
      expect(result).not.toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) return;
      expect(result.context?.contextLimit).toBe(50);
    });

    it("accepts an empty messages array", () => {
      const result = validateChatWorkflowBody({ ...validBody, messages: [] });
      expect(result).not.toBeInstanceOf(NextResponse);
    });
  });

  describe("invalid input", () => {
    it("rejects a non-object body with 400", async () => {
      const result = validateChatWorkflowBody("not-an-object");
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("rejects missing messages with 400", async () => {
      const { messages: _omit, ...rest } = validBody;
      const result = validateChatWorkflowBody(rest);
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(body.error).toBeDefined();
    });

    it("rejects non-array messages with 400", () => {
      const result = validateChatWorkflowBody({ ...validBody, messages: "nope" });
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("rejects missing chatId with 400", () => {
      const { chatId: _omit, ...rest } = validBody;
      const result = validateChatWorkflowBody(rest);
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("rejects missing sessionId with 400", () => {
      const { sessionId: _omit, ...rest } = validBody;
      const result = validateChatWorkflowBody(rest);
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("rejects empty-string chatId with 400", () => {
      const result = validateChatWorkflowBody({ ...validBody, chatId: "" });
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("rejects empty-string sessionId with 400", () => {
      const result = validateChatWorkflowBody({ ...validBody, sessionId: "" });
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("rejects non-integer context.contextLimit with 400", () => {
      const result = validateChatWorkflowBody({
        ...validBody,
        context: { contextLimit: "fifty" },
      });
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });
  });
});
