import { describe, it, expect } from "vitest";
import { hasGatewayShape } from "@/lib/agent/messageMetadata/hasGatewayShape";

describe("hasGatewayShape", () => {
  it("returns false for undefined metadata", () => {
    expect(hasGatewayShape(undefined)).toBe(false);
  });

  it("returns false when there is no `gateway` namespace", () => {
    expect(hasGatewayShape({ openai: { foo: "bar" } } as never)).toBe(false);
  });

  it("returns false when `gateway` is null", () => {
    expect(hasGatewayShape({ gateway: null } as never)).toBe(false);
  });

  it("returns false when `gateway` is a string (not an object)", () => {
    expect(hasGatewayShape({ gateway: "oops" } as never)).toBe(false);
  });

  it("returns true when `gateway` is an object (even empty)", () => {
    expect(hasGatewayShape({ gateway: {} } as never)).toBe(true);
    expect(hasGatewayShape({ gateway: { cost: "0.05" } } as never)).toBe(true);
  });
});
