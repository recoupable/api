import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetCreditSpendDigestRequest } from "../validateGetCreditSpendDigestRequest";

function request(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/internal/credit-spend-digest", {
    headers: authorization ? { authorization } : {},
  });
}

describe("validateGetCreditSpendDigestRequest", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
  });

  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it("returns null when the bearer token matches CRON_SECRET", () => {
    expect(validateGetCreditSpendDigestRequest(request("Bearer s3cret"))).toBeNull();
  });

  it("returns 401 when the bearer token is missing or wrong", async () => {
    const missing = validateGetCreditSpendDigestRequest(request());
    expect(missing).toBeInstanceOf(NextResponse);
    expect(missing?.status).toBe(401);

    const wrong = validateGetCreditSpendDigestRequest(request("Bearer nope"));
    expect(wrong?.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    const res = validateGetCreditSpendDigestRequest(request("Bearer s3cret"));
    expect(res).toBeInstanceOf(NextResponse);
    expect(res?.status).toBe(500);
  });
});
