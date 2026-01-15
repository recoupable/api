import { describe, it, expect } from "vitest";
import {
  validateCreateArtistBody,
  createArtistBodySchema,
} from "../validateCreateArtistBody";

describe("createArtistBodySchema", () => {
  it("accepts valid body with name and account_id", () => {
    const body = {
      name: "Test Artist",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const result = createArtistBodySchema.safeParse(body);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(body);
  });

  it("rejects body without name", () => {
    const body = {
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const result = createArtistBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it("rejects body without account_id", () => {
    const body = {
      name: "Test Artist",
    };

    const result = createArtistBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it("rejects body with invalid UUID for account_id", () => {
    const body = {
      name: "Test Artist",
      account_id: "not-a-uuid",
    };

    const result = createArtistBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it("rejects body with empty name", () => {
    const body = {
      name: "",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const result = createArtistBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });
});

describe("validateCreateArtistBody", () => {
  it("returns validated data for valid body", () => {
    const body = {
      name: "Test Artist",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const result = validateCreateArtistBody(body);
    expect(result).toEqual(body);
  });

  it("returns NextResponse with 400 for missing name", () => {
    const body = {
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const result = validateCreateArtistBody(body);
    expect(result.status).toBe(400);
  });

  it("returns NextResponse with error message for missing name", async () => {
    const body = {
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    const result = validateCreateArtistBody(body);
    const data = await result.json();
    expect(data.status).toBe("error");
    expect(data.error).toContain("name");
  });

  it("returns NextResponse with 400 for invalid UUID", async () => {
    const body = {
      name: "Test Artist",
      account_id: "invalid-uuid",
    };

    const result = validateCreateArtistBody(body);
    expect(result.status).toBe(400);
    const data = await result.json();
    expect(data.error).toContain("UUID");
  });

  it("includes CORS headers in error response", async () => {
    const body = {
      name: "Test Artist",
      account_id: "invalid-uuid",
    };

    const result = validateCreateArtistBody(body);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
