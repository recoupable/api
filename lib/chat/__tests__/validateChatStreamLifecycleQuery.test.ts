import { describe, expect, it } from "vitest";
import { validateChatStreamLifecycleQuery } from "@/lib/chat/validateChatStreamLifecycleQuery";

describe("single explicit Stop lifecycle query", () => {
  it.each([
    ["", false],
    ["?streamLifecycle=", false],
    ["?streamLifecycle=unknown", false],
    ["?streamLifecycle=explicit-stop-v2", false],
    ["?streamLifecycle=EXPLICIT-STOP-V1", false],
    ["?streamLifecycle=explicit-stop-v1", true],
    ["?startIndex=12&streamLifecycle=explicit-stop-v1", true],
    ["?streamLifecycle=explicit-stop-v1&streamLifecycle=explicit-stop-v1", false],
    ["?streamLifecycle=unknown&streamLifecycle=explicit-stop-v1", false],
  ])("validates %s without broadening legacy behavior", (query, expected) => {
    expect(validateChatStreamLifecycleQuery({ url: `https://api.test/api/chat${query}` })).toBe(
      expected,
    );
  });
});
