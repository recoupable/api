import { describe, it, expect } from "vitest";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";

const ISO = "2030-01-01T00:00:00.000Z";
const EPOCH = Date.parse(ISO);

describe("buildLifecycle", () => {
  it("converts every ISO timestamp on the row to epoch ms and sets serverTime", () => {
    const row = {
      lifecycle_state: "active",
      last_activity_at: ISO,
      hibernate_after: ISO,
      sandbox_expires_at: ISO,
    } as any;

    const result = buildLifecycle(row);

    expect(result).toEqual({
      serverTime: expect.any(Number),
      state: "active",
      lastActivityAt: EPOCH,
      hibernateAfter: EPOCH,
      sandboxExpiresAt: EPOCH,
    });
  });

  it("preserves null fields and a null lifecycle_state as-is", () => {
    const row = {
      lifecycle_state: null,
      last_activity_at: null,
      hibernate_after: null,
      sandbox_expires_at: null,
    } as any;

    const result = buildLifecycle(row);

    expect(result.state).toBeNull();
    expect(result.lastActivityAt).toBeNull();
    expect(result.hibernateAfter).toBeNull();
    expect(result.sandboxExpiresAt).toBeNull();
  });
});
