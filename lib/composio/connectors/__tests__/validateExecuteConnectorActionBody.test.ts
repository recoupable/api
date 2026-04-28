import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateExecuteConnectorActionBody } from "../validateExecuteConnectorActionBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => new Headers()),
}));

describe("validateExecuteConnectorActionBody", () => {
  it("should accept valid actionSlug + parameters", () => {
    const result = validateExecuteConnectorActionBody({
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: { max_results: 10 },
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: { max_results: 10 },
    });
  });

  it("should accept empty parameters object", () => {
    const result = validateExecuteConnectorActionBody({
      actionSlug: "GITHUB_LIST_REPOS",
      parameters: {},
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      actionSlug: "GITHUB_LIST_REPOS",
      parameters: {},
    });
  });

  it("should accept optional account_id", () => {
    const result = validateExecuteConnectorActionBody({
      actionSlug: "GOOGLESHEETS_WRITE_SPREADSHEET",
      parameters: { spreadsheet_id: "abc" },
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      actionSlug: "GOOGLESHEETS_WRITE_SPREADSHEET",
      parameters: { spreadsheet_id: "abc" },
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("should return 400 with field name when actionSlug is missing", async () => {
    const result = validateExecuteConnectorActionBody({ parameters: {} });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.missing_fields).toEqual(["actionSlug"]);
    expect(body.error).toBe("actionSlug is required");
  });

  it("should return 400 when actionSlug is empty", () => {
    const result = validateExecuteConnectorActionBody({
      actionSlug: "",
      parameters: {},
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 when parameters is missing", async () => {
    const result = validateExecuteConnectorActionBody({ actionSlug: "GMAIL_FETCH_EMAILS" });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.missing_fields).toEqual(["parameters"]);
  });

  it("should return 400 when parameters is not an object", () => {
    const result = validateExecuteConnectorActionBody({
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: "not-an-object",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid account_id UUID", () => {
    const result = validateExecuteConnectorActionBody({
      actionSlug: "GMAIL_FETCH_EMAILS",
      parameters: {},
      account_id: "not-a-uuid",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
  });
});
