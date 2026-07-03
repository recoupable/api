import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateRemoveOrgMemberQuery } from "../validateRemoveOrgMemberQuery";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function buildRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/organizations/members${query}`, {
    method: "DELETE",
  });
}

describe("validateRemoveOrgMemberQuery", () => {
  it("accepts valid organization_id and account_id", () => {
    const result = validateRemoveOrgMemberQuery(
      buildRequest(`?organization_id=${ORG_ID}&account_id=${ACCOUNT_ID}`),
    );

    expect(result).toEqual({ organization_id: ORG_ID, account_id: ACCOUNT_ID });
  });

  it("returns 400 when organization_id is missing", async () => {
    const result = validateRemoveOrgMemberQuery(buildRequest(`?account_id=${ACCOUNT_ID}`));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    }
  });

  it("returns 400 when account_id is missing", async () => {
    const result = validateRemoveOrgMemberQuery(buildRequest(`?organization_id=${ORG_ID}`));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 400 when organization_id is not a UUID", async () => {
    const result = validateRemoveOrgMemberQuery(
      buildRequest(`?organization_id=nope&account_id=${ACCOUNT_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 400 when account_id is not a UUID", async () => {
    const result = validateRemoveOrgMemberQuery(
      buildRequest(`?organization_id=${ORG_ID}&account_id=nope`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });
});
