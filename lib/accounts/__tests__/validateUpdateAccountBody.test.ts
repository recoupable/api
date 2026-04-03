import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateUpdateAccountBody } from "@/lib/accounts/validateUpdateAccountBody";

describe("validateUpdateAccountBody", () => {
  it("returns 400 when no update fields are provided", async () => {
    const result = validateUpdateAccountBody({});
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("At least one update field is required");
  });

  it("accepts body with update field only", () => {
    const result = validateUpdateAccountBody({ name: "Alice" });
    expect(result).toEqual({ name: "Alice" });
  });

  it("accepts admin override shape with accountId plus update field", () => {
    const accountId = "11111111-1111-4111-8111-111111111111";
    const result = validateUpdateAccountBody({ accountId, roleType: "manager" });
    expect(result).toEqual({ accountId, roleType: "manager" });
  });

  it("returns 400 when only accountId is provided (no update fields)", async () => {
    const accountId = "11111111-1111-4111-8111-111111111111";
    const result = validateUpdateAccountBody({ accountId });
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("At least one update field is required");
  });
});
