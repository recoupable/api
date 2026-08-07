import { describe, expect, it } from "vitest";

import { resolveCatalogPrimary } from "../resolveCatalogPrimary";

describe("resolveCatalogPrimary", () => {
  it("defaults to true when query is omitted", () => {
    expect(resolveCatalogPrimary()).toBe("true");
  });

  it("honors camelCase and snake_case values", () => {
    expect(resolveCatalogPrimary({ isPrimary: "false" })).toBe("false");
    expect(resolveCatalogPrimary({ is_primary: "false" })).toBe("false");
  });

  it("ignores empty primary flags so defaults are not forwarded as blank strings", () => {
    expect(resolveCatalogPrimary({ isPrimary: "" })).toBe("true");
    expect(resolveCatalogPrimary({ is_primary: "" })).toBe("true");
    expect(resolveCatalogPrimary({ isPrimary: "", is_primary: "false" })).toBe("false");
  });
});
