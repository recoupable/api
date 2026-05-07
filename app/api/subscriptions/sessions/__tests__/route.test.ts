import "./routeTestMocks";
import { describe, it, expect } from "vitest";

const { POST, OPTIONS } = await import("../route");

describe("app/api/subscriptions/sessions/route", () => {
  it("exports POST and OPTIONS handlers", () => {
    expect(typeof POST).toBe("function");
    expect(typeof OPTIONS).toBe("function");
  });
});
