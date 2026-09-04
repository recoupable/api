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

  it("400s when a field is missing", async () => {
    expect(
      await errorOf(await validateUpdateAutoTopUpBody(req({ enabled: true, amountCents: 10000 }))),
    ).toMatch(/thresholdCents/);
  });

  it("400s when amountCents is below 500 or above 100000", async () => {
    expect(
      await errorOf(
        await validateUpdateAutoTopUpBody(
          req({ enabled: true, amountCents: 499, thresholdCents: 0 }),
        ),
      ),
    ).toBe("amountCents must be between 500 and 100000");
    expect(
      await errorOf(
        await validateUpdateAutoTopUpBody(
          req({ enabled: true, amountCents: 100001, thresholdCents: 0 }),
        ),
      ),
    ).toBe("amountCents must be between 500 and 100000");
  });

  it("400s when amountCents is not an integer", async () => {
    expect(
      await errorOf(
        await validateUpdateAutoTopUpBody(
          req({ enabled: true, amountCents: 1000.5, thresholdCents: 0 }),
        ),
      ),
    ).toMatch(/amountCents/);
  });

  it("400s when thresholdCents is negative", async () => {
    expect(
      await errorOf(
        await validateUpdateAutoTopUpBody(
          req({ enabled: true, amountCents: 1000, thresholdCents: -1 }),
        ),
      ),
    ).toBe("thresholdCents must be 0 or more");
  });

  it("400s when thresholdCents is not below amountCents", async () => {
    expect(
      await errorOf(
        await validateUpdateAutoTopUpBody(
          req({ enabled: true, amountCents: 1000, thresholdCents: 1000 }),
        ),
      ),
    ).toBe("thresholdCents must be below amountCents");
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
