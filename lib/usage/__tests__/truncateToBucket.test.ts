import { describe, it, expect } from "vitest";
import { truncateToBucket } from "@/lib/usage/truncateToBucket";

const t = "2026-08-27T13:47:22.345Z"; // a Thursday

describe("truncateToBucket", () => {
  it("matches Postgres date_trunc in UTC", () => {
    expect(truncateToBucket(t, "hour")).toBe("2026-08-27T13:00:00.000Z");
    expect(truncateToBucket(t, "day")).toBe("2026-08-27T00:00:00.000Z");
    expect(truncateToBucket(t, "week")).toBe("2026-08-24T00:00:00.000Z");
    expect(truncateToBucket(t, "month")).toBe("2026-08-01T00:00:00.000Z");
  });

  it("starts weeks on Monday, so a Sunday belongs to the previous Monday", () => {
    expect(truncateToBucket("2026-08-30T23:59:59.000Z", "week")).toBe("2026-08-24T00:00:00.000Z");
    expect(truncateToBucket("2026-08-31T00:00:00.000Z", "week")).toBe("2026-08-31T00:00:00.000Z");
  });
});
