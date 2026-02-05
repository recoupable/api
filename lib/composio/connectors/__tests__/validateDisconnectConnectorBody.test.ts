import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateDisconnectConnectorBody } from "../validateDisconnectConnectorBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateDisconnectConnectorBody", () => {
  it("should accept valid disconnect request without account_id", () => {
    const result = validateDisconnectConnectorBody({
      connected_account_id: "ca_12345",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      connected_account_id: "ca_12345",
    });
  });

  it("should accept valid disconnect request with account_id", () => {
    const result = validateDisconnectConnectorBody({
      connected_account_id: "ca_12345",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      connected_account_id: "ca_12345",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("should return 400 when connected_account_id is missing", () => {
    const result = validateDisconnectConnectorBody({});

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 when connected_account_id is empty", () => {
    const result = validateDisconnectConnectorBody({
      connected_account_id: "",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid account_id UUID format", () => {
    const result = validateDisconnectConnectorBody({
      connected_account_id: "ca_12345",
      account_id: "not-a-uuid",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
