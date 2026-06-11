import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "../validateCronRequest";

const req = (auth?: string) =>
  new NextRequest("http://x/api/internal/playcount-maintenance", {
    headers: auth ? { authorization: auth } : {},
  });

describe("validateCronRequest", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cr3t";
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("passes a correct bearer", () => {
    expect(validateCronRequest(req("Bearer s3cr3t"))).toBeNull();
  });

  it("401s wrong or missing bearer", () => {
    for (const r of [req("Bearer wrong"), req()]) {
      const res = validateCronRequest(r);
      expect(res).toBeInstanceOf(NextResponse);
      expect((res as NextResponse).status).toBe(401);
    }
  });

  it("500s when CRON_SECRET is unset (misconfiguration, not open door)", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.CRON_SECRET;
    expect((validateCronRequest(req("Bearer s3cr3t")) as NextResponse).status).toBe(500);
    consoleError.mockRestore();
  });
});
