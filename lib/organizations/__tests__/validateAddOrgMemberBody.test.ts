import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateAddOrgMemberBody } from "../validateAddOrgMemberBody";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

describe("validateAddOrgMemberBody", () => {
  describe("valid bodies", () => {
    it("accepts organizationId with accountId", () => {
      const result = validateAddOrgMemberBody({
        organizationId: ORG_ID,
        accountId: ACCOUNT_ID,
      });

      expect(result).toEqual({ organizationId: ORG_ID, accountId: ACCOUNT_ID });
    });

    it("accepts organizationId with email", () => {
      const result = validateAddOrgMemberBody({
        organizationId: ORG_ID,
        email: "member@example.com",
      });

      expect(result).toEqual({ organizationId: ORG_ID, email: "member@example.com" });
    });
  });

  describe("invalid bodies", () => {
    it("returns 400 when organizationId is missing", async () => {
      const result = validateAddOrgMemberBody({ accountId: ACCOUNT_ID });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(typeof body.message).toBe("string");
      }
    });

    it("returns 400 when organizationId is not a UUID", async () => {
      const result = validateAddOrgMemberBody({
        organizationId: "not-a-uuid",
        accountId: ACCOUNT_ID,
      });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when accountId is not a UUID", async () => {
      const result = validateAddOrgMemberBody({
        organizationId: ORG_ID,
        accountId: "not-a-uuid",
      });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when email is not a valid email", async () => {
      const result = validateAddOrgMemberBody({
        organizationId: ORG_ID,
        email: "not-an-email",
      });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when both accountId and email are provided", async () => {
      const result = validateAddOrgMemberBody({
        organizationId: ORG_ID,
        accountId: ACCOUNT_ID,
        email: "member@example.com",
      });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.message).toContain("exactly one");
      }
    });

    it("returns 400 when neither accountId nor email is provided", async () => {
      const result = validateAddOrgMemberBody({ organizationId: ORG_ID });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.message).toContain("exactly one");
      }
    });

    it("returns 400 when body is null", async () => {
      const result = validateAddOrgMemberBody(null);

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });
  });
});
