import { describe, it, expect } from "vitest";
import { isApifyCapacityError } from "../isApifyCapacityError";

describe("isApifyCapacityError", () => {
  // Verbatim shape of the message Apify returns when the account's shared
  // actor-memory quota is saturated (measured 2026-08-11: 64GB / 32 jobs).
  it("detects the account memory-limit rejection", () => {
    expect(
      isApifyCapacityError(
        new Error("By launching this job you will exceed the memory limit of 65536MB"),
      ),
    ).toBe(true);
  });

  it("detects it regardless of casing", () => {
    expect(isApifyCapacityError(new Error("you will EXCEED THE MEMORY LIMIT of 65536MB"))).toBe(
      true,
    );
  });

  it("detects a concurrent-job-limit rejection", () => {
    expect(
      isApifyCapacityError(new Error("You have exceeded the maximum number of concurrent runs")),
    ).toBe(true);
  });

  it("detects a rate-limit rejection", () => {
    expect(isApifyCapacityError(new Error("Too many requests, rate limit exceeded"))).toBe(true);
  });

  // A failed run is a genuine upstream fault, not capacity, and must keep 5xx
  // semantics distinct so the two are not conflated in logs or by callers.
  it("does NOT treat a failed actor run as capacity", () => {
    expect(isApifyCapacityError(new Error("Bandsintown actor run failed with status FAILED"))).toBe(
      false,
    );
  });

  it("does NOT treat an arbitrary error as capacity", () => {
    expect(isApifyCapacityError(new Error("boom"))).toBe(false);
  });

  it("handles non-Error values without throwing", () => {
    expect(isApifyCapacityError("exceed the memory limit")).toBe(true);
    expect(isApifyCapacityError(null)).toBe(false);
    expect(isApifyCapacityError(undefined)).toBe(false);
    expect(isApifyCapacityError({ nope: true })).toBe(false);
  });
});
