import { describe, it, expect } from "vitest";
import { isSandboxUnavailableError } from "@/lib/sandbox/isSandboxUnavailableError";

describe("isSandboxUnavailableError", () => {
  it.each([
    "Expected a stream of command data",
    "Got status code 410",
    "status code 404 from sandbox",
    "Sandbox is stopped",
    "Sandbox not found in region",
    "Sandbox probe failed: unknown",
  ])("returns true for permanent-failure: %s", message => {
    expect(isSandboxUnavailableError(message)).toBe(true);
  });

  it.each([
    "ECONNRESET while reading sandbox stream",
    "fetch failed",
    "request timed out",
    "Status code 502 (bad gateway)",
    "Status code 503",
    "",
  ])("returns false for transient: %s", message => {
    expect(isSandboxUnavailableError(message)).toBe(false);
  });
});
