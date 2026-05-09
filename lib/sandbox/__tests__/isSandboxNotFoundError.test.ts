import { describe, it, expect } from "vitest";
import { isSandboxNotFoundError } from "@/lib/sandbox/isSandboxNotFoundError";

describe("isSandboxNotFoundError", () => {
  it.each([
    "Got status code 404 from sandbox API",
    "Sandbox not found",
    "STATUS CODE 404",
    "sandbox NOT FOUND in this region",
  ])("returns true for: %s", message => {
    expect(isSandboxNotFoundError(message)).toBe(true);
  });

  it.each(["request timed out", "ECONNREFUSED", "Status code 500", "sandbox is stopped", ""])(
    "returns false for: %s",
    message => {
      expect(isSandboxNotFoundError(message)).toBe(false);
    },
  );
});
