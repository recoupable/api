import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const { validateCreateSessionChatBody } = await import(
  "@/lib/sessions/validateCreateSessionChatBody"
);

describe("validateCreateSessionChatBody", () => {
  it("accepts an empty body", () => {
    const result = validateCreateSessionChatBody({});
    expect(result).toEqual({});
  });

  it("accepts a null body", () => {
    const result = validateCreateSessionChatBody(null);
    expect(result).toEqual({});
  });

  it("accepts a body with a valid id", () => {
    const result = validateCreateSessionChatBody({ id: "chat_abc" });
    expect(result).toEqual({ id: "chat_abc" });
  });

  it("rejects an empty id with 400 + parity error", async () => {
    const result = validateCreateSessionChatBody({ id: "" });
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({ error: "Invalid chat id" });
    }
  });

  it("rejects a non-string id with 400", () => {
    const result = validateCreateSessionChatBody({ id: 42 });
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("ignores unknown fields on the body", () => {
    const result = validateCreateSessionChatBody({ id: "chat_abc", junk: 1 });
    expect(result).toEqual({ id: "chat_abc" });
  });
});
