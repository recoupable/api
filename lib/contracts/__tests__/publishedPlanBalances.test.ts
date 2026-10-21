import Ajv from "ajv";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { buildAccountCreditsResponse } from "@/lib/credits/buildAccountCreditsResponse";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/stripe/config", () => ({ STRIPE_STARTER_PRICE_ID: "price_fixture_starter" }));
const { buildSubscriptionResponse } = await import("@/lib/stripe/buildSubscriptionResponse");
const contracts = fixture.planBalances;
const accountId = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-10-01T12:00:00Z";
const creditCases = [
  { name: "free", plan: "free", remaining: 3330000, timestamp: null },
  { name: "starter", plan: "starter", remaining: 15000000, timestamp },
  { name: "directPro", plan: "pro", remaining: 292450000, timestamp },
  { name: "organizationPro", plan: "pro", remaining: 292450000, timestamp },
  { name: "aboveAllotment", plan: "pro", remaining: 325000000, timestamp },
  { name: "negativeBalance", plan: "free", remaining: -1000, timestamp },
] as const;

function subscription(price: string, status: Stripe.Subscription.Status = "active") {
  return {
    status,
    canceled_at: null,
    items: { data: [{ price: { id: price } }] },
  } as Stripe.Subscription;
}

const starter = subscription("price_fixture_starter");
function creditsUsage(
  remaining: number,
  at: string | null,
): Parameters<typeof buildAccountCreditsResponse>[0]["creditsUsage"] {
  return {
    id: 1,
    account_id: accountId,
    remaining_credits: remaining,
    timestamp: at,
    auto_topup_amount: 0,
    auto_topup_enabled: false,
    auto_topup_last_error: null,
    auto_topup_last_run_at: null,
    auto_topup_threshold: 0,
  };
}

const pro = subscription("price_fixture_pro");
const subscriptionCases = [
  { name: "free", account: null, organization: null },
  { name: "starter", account: starter, organization: null },
  { name: "directPro", account: pro, organization: null },
  { name: "organizationPro", account: starter, organization: pro },
  { name: "inactive", account: subscription("price_fixture_pro", "canceled"), organization: null },
] as const;
const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
ajv.addFormat(
  "date-time",
  value =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)),
);

describe("published plan/balance examples against the existing pure builders", () => {
  it("declares nullable credit fields using standard JSON Schema types", () => {
    expect(contracts.credits.schema.properties.timestamp.type).toEqual(["string", "null"]);
    expect(contracts.credits.schema.properties.task_limit.type).toEqual(["integer", "null"]);
    expect(contracts.credits.schema.properties.timestamp).not.toHaveProperty("nullable");
    expect(contracts.credits.schema.properties.task_limit).not.toHaveProperty("nullable");
  });

  it.each(creditCases)("matches the published $name credit example", testCase => {
    const body = buildAccountCreditsResponse({
      creditsUsage: creditsUsage(testCase.remaining, testCase.timestamp),
      plan: testCase.plan,
    });
    const examples: Record<string, unknown> = contracts.credits.examples;
    expect(examples[testCase.name], `Missing published ${testCase.name} credits`).toBeDefined();
    expect(body).toEqual(examples[testCase.name]);
    const validate = ajv.compile(contracts.credits.schema);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    for (const field of Object.keys(body)) {
      const missing: Record<string, unknown> = { ...body };
      delete missing[field];
      expect(validate(missing), `Undeclared required credit field ${field}`).toBe(false);
    }
  });

  it.each(subscriptionCases)("matches the published $name subscription example", testCase => {
    const body = buildSubscriptionResponse(testCase);
    const examples: Record<string, unknown> = contracts.subscription.examples;
    expect(
      examples[testCase.name],
      `Missing published ${testCase.name} subscription`,
    ).toBeDefined();
    expect(body).toEqual(examples[testCase.name]);
    const validate = ajv.compile(contracts.subscription.schema);
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    for (const field of Object.keys(body)) {
      const missing: Record<string, unknown> = { ...body };
      delete missing[field];
      expect(validate(missing), `Undeclared required subscription field ${field}`).toBe(false);
    }
  });

  it("accepts nullable time and signed balances without legacy nullable", () => {
    const schema = structuredClone(contracts.credits.schema);
    for (const property of Object.values(schema.properties))
      Reflect.deleteProperty(property, "nullable");
    const validate = ajv.compile(schema);
    for (const remaining of [-1000, 3330000]) {
      const body = buildAccountCreditsResponse({
        creditsUsage: creditsUsage(remaining, null),
        plan: "free",
      });
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it("validates the copyable guide example including its identifier and time zone", () => {
    const validate = ajv.compile(contracts.credits.schema);
    expect(validate(contracts.guideCreditExample), JSON.stringify(validate.errors)).toBe(true);
    expect(contracts.guideCreditExample).toEqual(contracts.credits.examples.directPro);
  });

  it("keeps schema and property examples consistent with the main Pro example", () => {
    const example = contracts.credits.examples.directPro;
    expect(example).toBeDefined();
    expect(contracts.credits.schema.example).toEqual(example);
    for (const [field, value] of Object.entries(example)) {
      const properties: Record<string, { example?: unknown }> = contracts.credits.schema.properties;
      expect(properties[field].example, `Inconsistent credit example ${field}`).toEqual(value);
    }
  });

  it("rejects malformed identifiers, timestamps and task limits", () => {
    const example = contracts.credits.examples.directPro;
    expect(example).toBeDefined();
    expect(example.total_credits).toBe(300000000);
    expect(example.is_pro).toBe(true);
    expect(example.task_limit).toBeNull();
    const validate = ajv.compile(contracts.credits.schema);
    expect(validate({ ...example, task_limit: "unlimited" })).toBe(false);
    expect(validate({ ...example, timestamp: "2026-10-01T12:00:00" })).toBe(false);
    expect(validate({ ...example, account_id: "acc_…" })).toBe(false);
  });
});
