import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateAutoTopUpBody } from "@/lib/billing/validateUpdateAutoTopUpBody";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/accounts/x/auto-top-up", {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const errorOf = async (res: unknown) => {
  expect(res).toBeInstanceOf(NextResponse);
  const r = res as NextResponse;
  expect(r.status).toBe(400);
  return (await r.json()).error as string;
};

describe("validateUpdateAutoTopUpBody", () => {
  it("returns the parsed settings for a valid body", async () => {
    const result = await validateUpdateAutoTopUpBody(
      req({ enabled: true, amountCents: 10000, thresholdCents: 100 }),
    );
    expect(result).toEqual({ enabled: true, amountCents: 10000, thresholdCents: 100 });
  });

  it("accepts enabled: false with a threshold of 0", async () => {
    const result = await validateUpdateAutoTopUpBody(
      req({ enabled: false, amountCents: 500, thresholdCents: 0 }),
    );
    expect(result).toEqual({ enabled: false, amountCents: 500, thresholdCents: 0 });
  });

  it("400s on invalid JSON", async () => {
    expect(await errorOf(await validateUpdateAutoTopUpBody(req("{not json")))).toBe(
      "Invalid JSON body",
    );
  });

  it("400s with Zod's own message when the body is not an object", async () => {
    expect(await errorOf(await validateUpdateAutoTopUpBody(req(null)))).not.toMatch(
      /^ is required/,
    );
    expect(await errorOf(await validateUpdateAutoTopUpBody(req([1, 2])))).not.toMatch(
      /^ is required/,
    );
  });

  it("400s when a field is missing", async () => {
    expect(
      await errorOf(await validateUpdateAutoTopUpBody(req({ enabled: true, amountCents: 10000 }))),
    ).toMatch(/thresholdCents/);
  });

  it("400s on unknown keys", async () => {
    expect(
      await errorOf(
        await validateUpdateAutoTopUpBody(
          req({ enabled: true, amountCents: 1000, thresholdCents: 10, extra: 1 }),
        ),
      ),
    ).toMatch(/extra/i);
  });
});
