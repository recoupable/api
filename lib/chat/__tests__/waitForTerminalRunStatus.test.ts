import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitForTerminalRunStatus } from "@/lib/chat/waitForTerminalRunStatus";
import { getRun } from "workflow/api";

vi.mock("workflow/api", () => ({ getRun: vi.fn() }));

// Each call to `.status` resolves to the next queued value (or rejects for Error values).
const statusSequence = (...values: Array<string | Error>) => {
  let i = 0;
  vi.mocked(getRun).mockReturnValue({
    get status() {
      const v = values[Math.min(i, values.length - 1)];
      i += 1;
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v);
    },
  } as unknown as ReturnType<typeof getRun>);
};

describe("waitForTerminalRunStatus", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it("returns true immediately when the first status is terminal", async () => {
    statusSequence("cancelled");
    await expect(waitForTerminalRunStatus("run-1")).resolves.toBe(true);
  });

  it("swallows a transient probe error, then returns true on the next terminal poll", async () => {
    vi.useFakeTimers();
    statusSequence(new Error("transient"), "completed");
    const p = waitForTerminalRunStatus("run-1");
    await vi.advanceTimersByTimeAsync(150);
    await expect(p).resolves.toBe(true);
  });

  it("returns false when the run never reaches terminal before the timeout", async () => {
    vi.useFakeTimers();
    statusSequence("running");
    const p = waitForTerminalRunStatus("run-1");
    await vi.advanceTimersByTimeAsync(8100); // past the 8s deadline
    await expect(p).resolves.toBe(false);
  });
});
