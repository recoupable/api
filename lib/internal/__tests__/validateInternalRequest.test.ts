import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { validateInternalRequest } from "@/lib/internal/validateInternalRequest";

const requestWith = (authorization?: string) =>
  new NextRequest("https://api.recoupable.dev/api/notifications/lead", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });

describe("validateInternalRequest", () => {
  const original = process.env.INTERNAL_API_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "s3cr3t";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = original;
  });

  it("returns null when the bearer token matches", () => {
    expect(validateInternalRequest(requestWith("Bearer s3cr3t"))).toBeNull();
  });

  it("401s when the token does not match", async () => {
    const denied = validateInternalRequest(requestWith("Bearer wrong"));
    expect(denied?.status).toBe(401);
  });

  it("401s when the header is absent", () => {
    expect(validateInternalRequest(requestWith())?.status).toBe(401);
  });

  // A missing secret must not become an open door — an unconfigured deployment
  // should fail closed and loudly, exactly as validateCronRequest does.
  it("500s when INTERNAL_API_SECRET is unset (misconfiguration, not open door)", () => {
    delete process.env.INTERNAL_API_SECRET;
    expect(validateInternalRequest(requestWith("Bearer anything"))?.status).toBe(500);
  });

  it("never echoes the configured secret in the response body", async () => {
    const denied = validateInternalRequest(requestWith("Bearer wrong"));
    const body = await denied!.json();
    expect(JSON.stringify(body)).not.toContain("s3cr3t");
  });
});
