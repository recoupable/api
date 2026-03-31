import { describe, it, expect } from "vitest";
import { songsSchema } from "../songsSchema";

describe("songsSchema", () => {
  it("accepts a valid array of song slugs", () => {
    const result = songsSchema.safeParse(["hiccups", "adhd"]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(["hiccups", "adhd"]);
  });

  it("is optional (accepts undefined)", () => {
    const result = songsSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it("rejects empty strings", () => {
    const result = songsSchema.safeParse([""]);
    expect(result.success).toBe(false);
  });

  it("rejects non-string elements", () => {
    const result = songsSchema.safeParse([123]);
    expect(result.success).toBe(false);
  });
});
