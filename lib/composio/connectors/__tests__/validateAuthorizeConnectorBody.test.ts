import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateAuthorizeConnectorBody } from "../validateAuthorizeConnectorBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateAuthorizeConnectorBody", () => {
  it("should accept valid connector request without account_id", () => {
    const result = validateAuthorizeConnectorBody({
      connector: "googlesheets",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      connector: "googlesheets",
    });
  });

  it("should accept valid connector request with account_id for allowed connector", () => {
    const result = validateAuthorizeConnectorBody({
      connector: "tiktok",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      connector: "tiktok",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("should accept optional callback_url", () => {
    const result = validateAuthorizeConnectorBody({
      connector: "googlesheets",
      callback_url: "https://example.com/callback",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      connector: "googlesheets",
      callback_url: "https://example.com/callback",
    });
  });

  it("should return 400 when connector is missing", () => {
    const result = validateAuthorizeConnectorBody({});

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 when connector is empty", () => {
    const result = validateAuthorizeConnectorBody({ connector: "" });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 when account_id is provided but connector is not allowed", () => {
    const result = validateAuthorizeConnectorBody({
      connector: "googlesheets",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid callback_url format", () => {
    const result = validateAuthorizeConnectorBody({
      connector: "googlesheets",
      callback_url: "not-a-valid-url",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid account_id UUID format", () => {
    const result = validateAuthorizeConnectorBody({
      connector: "tiktok",
      account_id: "not-a-uuid",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
