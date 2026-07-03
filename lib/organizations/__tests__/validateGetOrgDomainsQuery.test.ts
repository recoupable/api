import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetOrgDomainsQuery } from "../validateGetOrgDomainsQuery";

const ORG_ID = "9f0b5f61-6f8d-4b64-92f5-0d1a5f0a1c2e";

describe("validateGetOrgDomainsQuery", () => {
  it("returns the validated query when organization_id is a UUID", () => {
    const result = validateGetOrgDomainsQuery(
      new NextRequest(`http://x/api/organizations/domains?organization_id=${ORG_ID}`),
    );

    expect(result).toEqual({ organization_id: ORG_ID });
  });

  it("returns 400 when organization_id is missing", async () => {
    const result = validateGetOrgDomainsQuery(
      new NextRequest("http://x/api/organizations/domains"),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(body.message).toContain("organization_id");
    }
  });

  it("returns 400 when organization_id is not a UUID", async () => {
    const result = validateGetOrgDomainsQuery(
      new NextRequest("http://x/api/organizations/domains?organization_id=org-1"),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });
});
