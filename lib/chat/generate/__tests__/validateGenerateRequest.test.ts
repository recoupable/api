import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGenerateRequest } from "@/lib/chat/generate/validateGenerateRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

function req(body: unknown): NextRequest {
  return new NextRequest("https://x.test/api/chat/generate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "recoup_sk_test" },
    body: JSON.stringify(body),
  });
}

const okAuth = { accountId: "acc-1", orgId: null, authToken: "recoup_sk_test" };

describe("validateGenerateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(okAuth);
  });

  it("converts a prompt into a single user UIMessage", async () => {
    const result = await validateGenerateRequest(req({ prompt: "weekly report please" }));
    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) return;
    expect(result.accountId).toBe("acc-1");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(JSON.stringify(result.messages[0].parts)).toContain("weekly report please");
  });

  it("passes messages through and applies the model override + default", async () => {
    const withModel = await validateGenerateRequest(
      req({
        messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
        model: "anthropic/claude-opus-4-8",
      }),
    );
    if (withModel instanceof NextResponse) throw new Error("unexpected error");
    expect(withModel.modelId).toBe("anthropic/claude-opus-4-8");

    const noModel = await validateGenerateRequest(req({ prompt: "hi" }));
    if (noModel instanceof NextResponse) throw new Error("unexpected error");
    expect(noModel.modelId).toBe("anthropic/claude-haiku-4.5");
  });

  it("rejects when neither prompt nor messages is provided (400)", async () => {
    const result = await validateGenerateRequest(req({ artistId: "a1" }));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
  });

  it("returns the auth error response when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const result = await validateGenerateRequest(req({ prompt: "hi" }));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(401);
  });

  it("forwards body accountId override to validateAuthContext", async () => {
    await validateGenerateRequest(req({ prompt: "hi", accountId: "member-acc" }));
    expect(validateAuthContext).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "member-acc" }),
    );
  });
});
