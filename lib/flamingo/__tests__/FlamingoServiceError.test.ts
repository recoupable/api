import { describe, it, expect } from "vitest";
import { FlamingoServiceError } from "../FlamingoServiceError";

describe("FlamingoServiceError", () => {
  it("keeps the status and detail and uses the documented message", () => {
    const err = new FlamingoServiceError(503, "Service Unavailable");

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("FlamingoServiceError");
    expect(err.status).toBe(503);
    expect(err.detail).toBe("Service Unavailable");
    expect(err.message).toBe("Music analysis failed (status 503)");
  });
});
