import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getAiGatewayCredential } from "@/lib/board/getAiGatewayCredential";

describe("getAiGatewayCredential", () => {
  const originalKey = process.env.AI_GATEWAY_API_KEY;
  const originalOidc = process.env.VERCEL_OIDC_TOKEN;

  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = originalKey;
    if (originalOidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = originalOidc;
  });

  it("prefers the AI Gateway API key", () => {
    process.env.AI_GATEWAY_API_KEY = "gw-key";
    process.env.VERCEL_OIDC_TOKEN = "oidc";
    expect(getAiGatewayCredential()).toBe("gw-key");
  });

  it("falls back to the deployment's OIDC token", () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc";
    expect(getAiGatewayCredential()).toBe("oidc");
  });

  it("throws when neither is set", () => {
    expect(() => getAiGatewayCredential()).toThrow("No AI Gateway credential");
  });
});
