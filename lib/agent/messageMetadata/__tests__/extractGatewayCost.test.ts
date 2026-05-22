import { describe, it, expect } from "vitest";
import { extractGatewayCost } from "@/lib/agent/messageMetadata/extractGatewayCost";

describe("extractGatewayCost", () => {
  it("returns undefined when providerMetadata is missing", () => {
    expect(extractGatewayCost(undefined)).toBeUndefined();
  });

  it("returns undefined when there is no `gateway` namespace", () => {
    expect(extractGatewayCost({ openai: { foo: "bar" } } as never)).toBeUndefined();
  });

  it("returns undefined when `gateway.cost` is missing", () => {
    expect(extractGatewayCost({ gateway: {} } as never)).toBeUndefined();
  });

  it("parses a numeric string cost", () => {
    expect(extractGatewayCost({ gateway: { cost: "0.0420" } } as never)).toBe(0.042);
  });

  it("returns undefined when cost is non-numeric", () => {
    expect(extractGatewayCost({ gateway: { cost: "not-a-number" } } as never)).toBeUndefined();
  });

  it("returns undefined when cost is a number (gateway should send strings)", () => {
    expect(extractGatewayCost({ gateway: { cost: 0.05 } } as never)).toBeUndefined();
  });
});
