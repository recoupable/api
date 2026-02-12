import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateGetConnectorsQuery } from "../validateGetConnectorsQuery";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateGetConnectorsQuery", () => {
  it("should return empty object when no params provided", () => {
    const searchParams = new URLSearchParams();
    const result = validateGetConnectorsQuery(searchParams);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({});
  });

  it("should accept valid account_id UUID", () => {
    const searchParams = new URLSearchParams({
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    const result = validateGetConnectorsQuery(searchParams);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("should return 400 for invalid account_id UUID format", () => {
    const searchParams = new URLSearchParams({
      account_id: "not-a-uuid",
    });
    const result = validateGetConnectorsQuery(searchParams);

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
