import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateRemoveOrgDomainQuery } from "../validateRemoveOrgDomainQuery";

const ORG_ID = "9f0b5f61-6f8d-4b64-92f5-0d1a5f0a1c2e";

describe("validateRemoveOrgDomainQuery", () => {
  it("returns the validated query with a normalized domain", () => {
    const result = validateRemoveOrgDomainQuery(
      new NextRequest(
        `http://x/api/organizations/domains?organization_id=${ORG_ID}&domain=@SeekerMusic.COM`,
      ),
    );

    expect(result).toEqual({ organization_id: ORG_ID, domain: "seekermusic.com" });
  });

  it("returns 400 when organization_id is missing", async () => {
    const result = validateRemoveOrgDomainQuery(
      new NextRequest("http://x/api/organizations/domains?domain=seekermusic.com"),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(body.message).toContain("organization_id");
    }
  });

  it("returns 400 when domain is missing", async () => {
    const result = validateRemoveOrgDomainQuery(
      new NextRequest(`http://x/api/organizations/domains?organization_id=${ORG_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.message).toContain("domain");
    }
  });

  it("returns 400 when domain is not a plausible bare domain", async () => {
    const result = validateRemoveOrgDomainQuery(
      new NextRequest(`http://x/api/organizations/domains?organization_id=${ORG_ID}&domain=nodot`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });
});
