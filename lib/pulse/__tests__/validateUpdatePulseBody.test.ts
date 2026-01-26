import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateUpdatePulseBody } from "../validateUpdatePulseBody";

describe("validateUpdatePulseBody", () => {
  describe("valid inputs", () => {
    it("accepts active: true", () => {
      const result = validateUpdatePulseBody({ active: true });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ active: true });
    });

    it("accepts active: false", () => {
      const result = validateUpdatePulseBody({ active: false });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ active: false });
    });

    it("accepts active with valid account_id UUID", () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const result = validateUpdatePulseBody({ active: true, account_id: accountId });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ active: true, account_id: accountId });
    });

    it("accepts active without account_id (optional)", () => {
      const result = validateUpdatePulseBody({ active: false });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ active: false });
    });
  });

  describe("invalid inputs", () => {
    it("rejects missing active field", () => {
      const result = validateUpdatePulseBody({});

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects active as string", () => {
      const result = validateUpdatePulseBody({ active: "true" });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects active as number", () => {
      const result = validateUpdatePulseBody({ active: 1 });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects invalid account_id (not a UUID)", () => {
      const result = validateUpdatePulseBody({ active: true, account_id: "not-a-uuid" });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects null body", () => {
      const result = validateUpdatePulseBody(null);

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects undefined body", () => {
      const result = validateUpdatePulseBody(undefined);

      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe("error response format", () => {
    it("returns 400 status for validation errors", async () => {
      const result = validateUpdatePulseBody({});

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
      }
    });
  });
});
