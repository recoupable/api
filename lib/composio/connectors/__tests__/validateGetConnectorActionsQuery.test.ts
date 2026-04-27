import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateGetConnectorActionsQuery } from "../validateGetConnectorActionsQuery";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateGetConnectorActionsQuery", () => {
  it("should accept empty query", () => {
    const result = validateGetConnectorActionsQuery(new URLSearchParams());

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ account_id: undefined });
  });

  it("should accept valid uuid account_id", () => {
    const result = validateGetConnectorActionsQuery(
      new URLSearchParams({ account_id: "550e8400-e29b-41d4-a716-446655440000" }),
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ account_id: "550e8400-e29b-41d4-a716-446655440000" });
  });

  it("should return 400 for invalid uuid account_id", async () => {
    const result = validateGetConnectorActionsQuery(
      new URLSearchParams({ account_id: "not-a-uuid" }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("account_id must be a valid UUID");
  });
});
