import { describe, it, expect } from "vitest";
import { buildClaudeSandboxNetworkPolicy } from "@/lib/board/buildClaudeSandboxNetworkPolicy";

describe("buildClaudeSandboxNetworkPolicy", () => {
  const boardAllow = {
    "api.vercel.com": [{ transform: [{ headers: { authorization: "Bearer board" } }] }],
  };

  it("allows only the board, npm and AI Gateway", () => {
    const policy = buildClaudeSandboxNetworkPolicy({ boardAllow, gatewayToken: "gw" });
    expect(Object.keys(policy.allow).sort()).toEqual(
      ["ai-gateway.vercel.sh", "api.vercel.com", "registry.npmjs.org"].sort(),
    );
    expect(policy.allow["*"]).toBeUndefined();
  });

  it("keeps the board's own rules untouched", () => {
    const policy = buildClaudeSandboxNetworkPolicy({ boardAllow, gatewayToken: "gw" });
    expect(policy.allow["api.vercel.com"]).toBe(boardAllow["api.vercel.com"]);
  });

  it("passes the board's route matchers and refusals through unchanged", () => {
    const scoped = {
      "api.vercel.com": [
        {
          match: { path: { startsWith: "/v1/messageboard/boards/b1" } },
          transform: [{ headers: { authorization: "Bearer board" } }],
        },
        { response: { statusCode: 403 } },
      ],
    };
    const policy = buildClaudeSandboxNetworkPolicy({
      boardAllow: scoped as never,
      gatewayToken: "gw",
    });
    expect(policy.allow["api.vercel.com"]).toEqual(scoped["api.vercel.com"]);
  });

  it("adds the gateway credential on the way out instead of inside the sandbox", () => {
    const policy = buildClaudeSandboxNetworkPolicy({ boardAllow, gatewayToken: "gw" });
    expect(policy.allow["ai-gateway.vercel.sh"]).toEqual([
      { transform: [{ headers: { Authorization: "Bearer gw" } }] },
    ]);
  });
});
