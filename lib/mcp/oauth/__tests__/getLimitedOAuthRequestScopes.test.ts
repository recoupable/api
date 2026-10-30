import { expect, it } from "vitest";
import { getLimitedOAuthRequestScopes } from "../getLimitedOAuthRequestScopes";

it("leaves invalid JSON available to the existing transport without inventing a scope", async () => {
  const request = new Request("https://api.example/mcp", { method: "POST", body: "{" });
  expect(await getLimitedOAuthRequestScopes(request)).toEqual([]);
  expect(await request.text()).toBe("{");
});
it("does not inspect stream requests or notifications for scope upgrades", async () => {
  expect(await getLimitedOAuthRequestScopes(new Request("https://api.example/mcp"))).toEqual([]);
  const notification = new Request("https://api.example/mcp", {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "create_new_artist" },
    }),
  });
  expect(await getLimitedOAuthRequestScopes(notification)).toEqual([]);
});
