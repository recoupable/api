import { expect, it } from "vitest";
import { encodeStrictJson } from "../encodeStrictJson";
it.each(["\u0000", "\ud800", "\udfff", "a\ud800b", "\udc00\ud800"])(
  "rejects invalid storage characters in recursive keys and values: %j",
  value => {
    expect(() => encodeStrictJson({ nested: [{ text: value }] })).toThrow();
    expect(() => encodeStrictJson({ nested: [{ [value]: true }] })).toThrow();
  },
);
it("preserves valid pairs, UTF16 key ordering and distinct normalization", () => {
  expect(encodeStrictJson({ "\ue000": 1, "😀": "é", e: "e\u0301", "10": 1e-7, "2": -0 })).toBe(
    '{"10":1e-7,"2":0,"e":"é","😀":"é","":1}',
  );
});
