import { describe, it, expect } from "vitest";
import { findValue } from "../findValue";

describe("findValue", () => {
  it("finds a key at the top level", () => {
    expect(findValue({ id: "1" }, ["id"])).toBe("1");
  });

  it("walks data, result and response envelopes", () => {
    expect(
      findValue({ data: { response: { result: { media_id: 42 } } } }, ["id", "media_id"]),
    ).toBe("42");
  });

  it("prefers the first matching key", () => {
    expect(findValue({ media_id_string: "a", id: "b" }, ["media_id_string", "id"])).toBe("a");
  });

  it("returns null for missing keys, objects and non-objects", () => {
    expect(findValue({ id: { nested: true } }, ["id"])).toBeNull();
    expect(findValue(null, ["id"])).toBeNull();
    expect(findValue("x", ["id"])).toBeNull();
  });
});
