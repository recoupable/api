import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CHAT_ID = "11111111-1111-1111-1111-111111111111";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";

const validBody = {
  messages: [{ id: "m-1", role: "user", parts: [{ type: "text", text: "hi" }] }],
  chatId: CHAT_ID,
  sessionId: SESSION_ID,
};

function makeRequest(body: unknown = validBody): NextRequest {
  return new NextRequest("http://localhost/api/chat/workflow", {
    method: "POST",
    headers: { "x-api-key": "k", "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockAuthOk() {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ACCOUNT_ID,
    orgId: null,
    authToken: "k",
  });
}

describe("validateChatWorkflow", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("valid input", () => {
    beforeEach(() => mockAuthOk());

    it("returns the validated body augmented with accountId / orgId / authToken", async () => {
      const result = await validateChatWorkflow(makeRequest());
      expect(result).not.toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) return;
      expect(result.chatId).toBe(CHAT_ID);
      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.messages).toEqual(validBody.messages);
      expect(result.accountId).toBe(ACCOUNT_ID);
      expect(result.orgId).toBe(null);
      expect(result.authToken).toBe("k");
    });

    it("accepts an optional context.contextLimit integer", async () => {
      const result = await validateChatWorkflow(
        makeRequest({ ...validBody, context: { contextLimit: 50 } }),
      );
      expect(result).not.toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) return;
      expect(result.context?.contextLimit).toBe(50);
    });

    it("accepts an empty messages array", async () => {
      const result = await validateChatWorkflow(makeRequest({ ...validBody, messages: [] }));
      expect(result).not.toBeInstanceOf(NextResponse);
    });

    // Bundle A.4 — open-agents' chat UI sends `recoupAccessToken`
    // (the user's Privy JWT) in the request body. Today api silently
    // strips it via Zod's default `.strip()` mode. After A.4 the
    // schema must accept the field so the handler can forward it.
    it("accepts and surfaces an optional recoupAccessToken from the body", async () => {
      const result = await validateChatWorkflow(
        makeRequest({ ...validBody, recoupAccessToken: "eyJ.test.jwt" }),
      );
      expect(result).not.toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) return;
      expect(result.recoupAccessToken).toBe("eyJ.test.jwt");
    });
  });

  describe("invalid body", () => {
    it("returns 400 when JSON is malformed", async () => {
      const req = new NextRequest("http://localhost/api/chat/workflow", {
        method: "POST",
        headers: { "x-api-key": "k", "content-type": "application/json" },
        body: "{not-json",
      });
      const result = await validateChatWorkflow(req);
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("returns 400 when chatId is missing", async () => {
      const { chatId: _omit, ...rest } = validBody;
      const result = await validateChatWorkflow(makeRequest(rest));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("returns 400 when sessionId is missing", async () => {
      const { sessionId: _omit, ...rest } = validBody;
      const result = await validateChatWorkflow(makeRequest(rest));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("returns 400 when messages is not an array", async () => {
      const result = await validateChatWorkflow(makeRequest({ ...validBody, messages: "nope" }));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("returns 400 when chatId is empty string", async () => {
      const result = await validateChatWorkflow(makeRequest({ ...validBody, chatId: "" }));
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("returns 400 when context.contextLimit is not an integer", async () => {
      const result = await validateChatWorkflow(
        makeRequest({ ...validBody, context: { contextLimit: "fifty" } }),
      );
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(400);
    });

    it("does not call validateAuthContext when body validation fails", async () => {
      const { chatId: _omit, ...rest } = validBody;
      await validateChatWorkflow(makeRequest(rest));
      expect(validateAuthContext).not.toHaveBeenCalled();
    });
  });

  describe("auth", () => {
    it("returns the auth short-circuit response when validateAuthContext rejects", async () => {
      const authError = NextResponse.json(
        { status: "error", error: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(authError);
      const result = await validateChatWorkflow(makeRequest());
      expect(result).toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) return;
      expect(result.status).toBe(401);
    });
  });
});
