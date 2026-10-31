import { expect, it } from "vitest";
import { getLimitedOAuthRequestScopes } from "../getLimitedOAuthRequestScopes";

it("does not infer a scope from absent or invalid protocol bodies", () => {
  for (const body of [undefined, null, "{", {}, []])
    expect(getLimitedOAuthRequestScopes(body)).toEqual([]);
});
it("does not infer scope upgrades from notifications", () => {
  expect(
    getLimitedOAuthRequestScopes({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "create_new_artist" },
    }),
  ).toEqual([]);
});
