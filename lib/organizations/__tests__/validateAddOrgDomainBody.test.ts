import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateAddOrgDomainBody } from "../validateAddOrgDomainBody";

const ORG_ID = "9f0b5f61-6f8d-4b64-92f5-0d1a5f0a1c2e";

describe("validateAddOrgDomainBody", () => {
  describe("valid bodies", () => {
    it("returns the validated body with a normalized domain", () => {
      const result = validateAddOrgDomainBody({
        organizationId: ORG_ID,
        domain: " @SeekerMusic.COM ",
      });

      expect(result).toEqual({ organizationId: ORG_ID, domain: "seekermusic.com" });
    });
  });

  describe("invalid bodies", () => {
    it("returns 400 when organizationId is missing", async () => {
      const result = validateAddOrgDomainBody({ domain: "seekermusic.com" });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(body.message).toContain("organizationId");
      }
    });

    it("returns 400 when organizationId is not a UUID", async () => {
      const result = validateAddOrgDomainBody({ organizationId: "org-1", domain: "a.com" });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when domain is missing", async () => {
      const result = validateAddOrgDomainBody({ organizationId: ORG_ID });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.message).toContain("domain");
      }
    });

    it("returns 400 when domain is not a plausible bare domain", async () => {
      const result = validateAddOrgDomainBody({
        organizationId: ORG_ID,
        domain: "not a domain",
      });

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(body.message).toContain("domain");
      }
    });

    it("returns 400 for a full email address", async () => {
      const result = validateAddOrgDomainBody({
        organizationId: ORG_ID,
        domain: "sam@seekermusic.com",
      });

      expect(result).toBeInstanceOf(NextResponse);
    });
  });
});
