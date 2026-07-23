import { describe, it, expect, vi, beforeEach } from "vitest";
import { markZombieOwnerAlerted } from "@/lib/chat/runs/markZombieOwnerAlerted";
import redis from "@/lib/redis/connection";

vi.mock("@/lib/redis/connection", () => ({
  default: { set: vi.fn() },
}));

describe("markZombieOwnerAlerted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims the marker with SET NX + a TTL and returns true on first alert", async () => {
    vi.mocked(redis.set).mockResolvedValue("OK");

    const shouldSend = await markZombieOwnerAlerted("acc-1");

    expect(shouldSend).toBe(true);
    const args = vi.mocked(redis.set).mock.calls[0];
    expect(args[0]).toContain("acc-1");
    // NX so a concurrent/repeat run can't re-claim; EX so it auto-expires.
    expect(args).toContain("NX");
    expect(args).toContain("EX");
  });

  it("returns false when the marker already exists (deduped — skip the alert)", async () => {
    vi.mocked(redis.set).mockResolvedValue(null);

    expect(await markZombieOwnerAlerted("acc-1")).toBe(false);
  });

  it("returns true (fails open) when Redis errors — never silences a real alert on infra blips", async () => {
    vi.mocked(redis.set).mockRejectedValue(new Error("redis down"));

    expect(await markZombieOwnerAlerted("acc-1")).toBe(true);
  });
});
