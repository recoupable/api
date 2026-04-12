import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateAgentVerifyBody } from "@/lib/agents/validateAgentVerifyBody";

describe("validateAgentVerifyBody", () => {
  it("returns validated body for valid input", () => {
    const result = validateAgentVerifyBody({ email: "user@example.com", code: "123456" });
    expect(result).toEqual({ email: "user@example.com", code: "123456" });
  });

  it("returns 400 for missing email", () => {
    const result = validateAgentVerifyBody({ code: "123456" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for missing code", () => {
    const result = validateAgentVerifyBody({ email: "user@example.com" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for empty code", () => {
    const result = validateAgentVerifyBody({ email: "user@example.com", code: "" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for invalid email", () => {
    const result = validateAgentVerifyBody({ email: "bad", code: "123456" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for non-numeric code", () => {
    const result = validateAgentVerifyBody({ email: "user@example.com", code: "abcdef" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for 5-digit code", () => {
    const result = validateAgentVerifyBody({ email: "user@example.com", code: "12345" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for 7-digit code", () => {
    const result = validateAgentVerifyBody({ email: "user@example.com", code: "1234567" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 for code with spaces", () => {
    const result = validateAgentVerifyBody({ email: "user@example.com", code: "123 456" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
