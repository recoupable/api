import { describe, it, expect } from "vitest";
import { liveXText } from "../liveXText";

describe("liveXText", () => {
  it("strips the trailing media link and decodes entities", () => {
    expect(liveXText({ data: { data: { text: "A &amp; B &lt;3 https://t.co/xyz" } } })).toBe(
      "A & B <3",
    );
  });

  it("returns null when the lookup has no text", () => {
    expect(liveXText(null)).toBeNull();
  });
});
