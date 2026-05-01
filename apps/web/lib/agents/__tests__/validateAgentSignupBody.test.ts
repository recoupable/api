import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAgentSignupBody } from "@/lib/agents/validateAgentSignupBody";

/**
 * Builds a NextRequest with the given body for the agent signup endpoint.
 *
 * @param body - JSON body to serialize, or undefined for an empty request
 * @returns A NextRequest pointed at /api/agents/signup
 */
function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agents/signup", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("validateAgentSignupBody", () => {
  it("returns validated body for valid agent+ email", async () => {
    const result = await validateAgentSignupBody(buildRequest({ email: "agent+test@example.com" }));
    expect(result).toEqual({ email: "agent+test@example.com" });
  });

  it("returns validated body for normal email", async () => {
    const result = await validateAgentSignupBody(buildRequest({ email: "user@example.com" }));
    expect(result).toEqual({ email: "user@example.com" });
  });

  it("returns 400 for missing email", async () => {
    const result = await validateAgentSignupBody(buildRequest({}));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const result = await validateAgentSignupBody(buildRequest({ email: "not-an-email" }));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for empty body", async () => {
    const result = await validateAgentSignupBody(buildRequest(undefined));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/agents/signup", {
      method: "POST",
      body: "{not valid json",
    });
    const result = await validateAgentSignupBody(req);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
