import { describe, it, expect } from "vitest";
import { buildAttioName } from "@/lib/leads/buildAttioName";

// Ported from marketing#68 with its tests: Attio 400s on a name value missing
// full_name, and JSON.stringify drops undefined keys, so last_name must always
// be a string. recoupable/chat#1800.
describe("buildAttioName", () => {
  it("sends full_name for a two-part name — Attio 400s without it", () => {
    expect(buildAttioName("Ada Lovelace")).toEqual([
      { first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace" },
    ]);
  });

  it("sends a string last_name for a single-word name, never undefined", () => {
    const value = buildAttioName("Prince");
    expect(value).toEqual([{ first_name: "Prince", last_name: "", full_name: "Prince" }]);
    expect(value?.[0]).toHaveProperty("last_name");
  });

  it("joins three or more parts into last_name and full_name", () => {
    expect(buildAttioName("Ada King Lovelace")).toEqual([
      { first_name: "Ada", last_name: "King Lovelace", full_name: "Ada King Lovelace" },
    ]);
  });

  it("returns undefined for no name or a whitespace-only name", () => {
    expect(buildAttioName(undefined)).toBeUndefined();
    expect(buildAttioName("   ")).toBeUndefined();
  });
});
