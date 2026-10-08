import { expect, it } from "vitest";
import { getOAuthResourceMetadata } from "../getOAuthResourceMetadata";
it("advertises only the canonical resource and audited launch scopes", () => {
  expect(getOAuthResourceMetadata("https://api.recoupable.dev/api/oauth")).toEqual({
    resource: "https://api.recoupable.dev/mcp",
    authorization_servers: ["https://api.recoupable.dev/api/oauth"],
    scopes_supported: ["mcp:read", "mcp:write", "mcp:tools"],
    bearer_methods_supported: ["header"],
    resource_name: "Recoup",
  });
  for (const issuer of [
    "https://evil.example/api/oauth?x=1",
    "https://user:pass@api.example/api/oauth",
    "http://api.example/api/oauth",
    "https://api.example/wrong",
  ])
    expect(() => getOAuthResourceMetadata(issuer)).toThrow();
});
