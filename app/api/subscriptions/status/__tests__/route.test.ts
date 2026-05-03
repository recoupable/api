import "./routeTestMocks";
import { describe, it, expect } from "vitest";

const { GET, OPTIONS } = await import("../route");

describe("app/api/subscriptions/status/route", () => {
  it("exports GET and OPTIONS handlers", () => {
    expect(typeof GET).toBe("function");
    expect(typeof OPTIONS).toBe("function");
  });
});
