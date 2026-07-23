import { describe, it, expect } from "vitest";
import { isOwnerInactive, ZOMBIE_OWNER_INACTIVE_DAYS } from "@/lib/chat/runs/isOwnerInactive";

const now = new Date("2026-07-23T00:00:00.000Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("isOwnerInactive", () => {
  it("treats a missing last-message timestamp as inactive (no human message ever)", () => {
    expect(isOwnerInactive(null, now)).toBe(true);
  });

  it("is inactive when the last user message is older than the threshold", () => {
    expect(isOwnerInactive(daysAgo(ZOMBIE_OWNER_INACTIVE_DAYS + 1), now)).toBe(true);
  });

  it("is active when the last user message is within the threshold", () => {
    expect(isOwnerInactive(daysAgo(ZOMBIE_OWNER_INACTIVE_DAYS - 1), now)).toBe(false);
  });

  it("is active for a message exactly at the threshold (not yet stale)", () => {
    expect(isOwnerInactive(daysAgo(ZOMBIE_OWNER_INACTIVE_DAYS), now)).toBe(false);
  });

  it("is active for a message from today", () => {
    expect(isOwnerInactive(now.toISOString(), now)).toBe(false);
  });

  it("uses a 45-day threshold", () => {
    expect(ZOMBIE_OWNER_INACTIVE_DAYS).toBe(45);
  });
});
