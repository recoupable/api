import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateAgentSignupBody } from "@/lib/agents/validateAgentSignupBody";

describe("validateAgentSignupBody", () => {
  it("returns validated body for valid email", () => {
    const result = validateAgentSignupBody({ email: "agent+test@example.com" });
    expect(result).toEqual({ email: "agent+test@example.com" });
  });

  it("returns validated body for normal email", () => {
    const result = validateAgentSignupBody({ email: "user@example.com" });
    expect(result).toEqual({ email: "user@example.com" });
  });

  it("returns 400 for missing email", () => {
    const result = validateAgentSignupBody({});
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for invalid email", () => {
    const result = validateAgentSignupBody({ email: "not-an-email" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for empty body", () => {
    const result = validateAgentSignupBody(null);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
