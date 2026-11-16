import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimIngestionDispatch } from "../claimIngestionDispatch";
const mocks = vi.hoisted(() => ({
  construct: vi.fn(),
  connect: vi.fn(),
  set: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("ioredis", () => ({
  Redis: class {
    connect = mocks.connect;
    set = mocks.set;
    on = mocks.on;
    disconnect = mocks.disconnect;
    constructor(...args: unknown[]) {
      mocks.construct(...args);
    }
  },
}));
describe("atomic dispatch lease", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("INGESTION_REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("REDIS_URL", "");
  });
  it("uses one atomic NX write with a ten-minute TTL", async () => {
    mocks.set.mockResolvedValue("OK");
    expect(await claimIngestionDispatch("a".repeat(64))).toBe(true);
    expect(mocks.set).toHaveBeenCalledWith(
      `recoup:ingestion:dispatch:${"a".repeat(64)}`,
      "claimed",
      "EX",
      600,
      "NX",
    );
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
  it("does not acquire an existing lease", async () => {
    mocks.set.mockResolvedValue(null);
    expect(await claimIngestionDispatch("a".repeat(64))).toBe(false);
  });
  it("rejects invalid IDs and missing storage without connecting", async () => {
    await expect(claimIngestionDispatch("bad-id")).rejects.toThrow("Invalid ingestion job");
    vi.stubEnv("INGESTION_REDIS_URL", "");
    await expect(claimIngestionDispatch("a".repeat(64))).rejects.toThrow(
      "Ingestion dispatch storage unavailable",
    );
    expect(mocks.construct).not.toHaveBeenCalled();
  });
  it("disconnects and fails closed on a lease storage outage", async () => {
    mocks.connect.mockRejectedValue(new Error("storage unavailable"));
    await expect(claimIngestionDispatch("a".repeat(64))).rejects.toThrow("storage unavailable");
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
});
