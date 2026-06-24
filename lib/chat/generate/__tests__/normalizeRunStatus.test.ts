import { describe, it, expect } from "vitest";
import { normalizeRunStatus } from "@/lib/chat/generate/normalizeRunStatus";

describe("normalizeRunStatus", () => {
  it("maps known states to the documented enum", () => {
    expect(normalizeRunStatus("queued")).toBe("queued");
    expect(normalizeRunStatus("running")).toBe("running");
    expect(normalizeRunStatus("pending")).toBe("running");
    expect(normalizeRunStatus("completed")).toBe("completed");
    expect(normalizeRunStatus("succeeded")).toBe("completed");
    expect(normalizeRunStatus("failed")).toBe("failed");
    expect(normalizeRunStatus("error")).toBe("failed");
    expect(normalizeRunStatus("cancelled")).toBe("cancelled");
    expect(normalizeRunStatus("canceled")).toBe("cancelled");
  });

  it("is case-insensitive", () => {
    expect(normalizeRunStatus("COMPLETED")).toBe("completed");
    expect(normalizeRunStatus("Running")).toBe("running");
  });

  it("defaults unknown strings to running (no invented terminal state)", () => {
    expect(normalizeRunStatus("something-new")).toBe("running");
  });
});
