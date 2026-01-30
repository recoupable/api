import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateSandboxBody } from "../validateSandboxBody";

describe("validateSandboxBody", () => {
  it("returns validated body when prompt is provided", () => {
    const body = { prompt: "tell me hello" };
    const result = validateSandboxBody(body);

    expect(result).toEqual({ prompt: "tell me hello" });
  });

  it("returns error response when prompt is missing", () => {
    const body = {};
    const result = validateSandboxBody(body);

    expect(result).toBeInstanceOf(NextResponse);
  });

  it("returns error response when prompt is empty string", () => {
    const body = { prompt: "" };
    const result = validateSandboxBody(body);

    expect(result).toBeInstanceOf(NextResponse);
  });

  it("returns error response when prompt is not a string", () => {
    const body = { prompt: 123 };
    const result = validateSandboxBody(body);

    expect(result).toBeInstanceOf(NextResponse);
  });
});
