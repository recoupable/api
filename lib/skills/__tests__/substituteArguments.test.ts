import { describe, it, expect } from "vitest";
import { substituteArguments } from "@/lib/skills/substituteArguments";

describe("substituteArguments", () => {
  it("replaces $ARGUMENTS with the provided args", () => {
    expect(substituteArguments("run with $ARGUMENTS", "--flag value")).toBe(
      "run with --flag value",
    );
  });

  it("replaces all occurrences", () => {
    expect(substituteArguments("$ARGUMENTS / $ARGUMENTS", "x")).toBe("x / x");
  });

  it("substitutes empty string when args are undefined", () => {
    expect(substituteArguments("run with $ARGUMENTS", undefined)).toBe("run with ");
  });

  it("leaves text unchanged when $ARGUMENTS is absent", () => {
    expect(substituteArguments("no placeholder here", "ignored")).toBe("no placeholder here");
  });
});
