import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMusicLogs } from "../fetchMusicLogs";
import fal from "@/lib/fal/server";

vi.mock("@/lib/fal/server", () => ({ default: { queue: { status: vi.fn() } } }));

const status = vi.mocked(fal.queue.status);

describe("fetchMusicLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks fal for logs and returns them on the documented shape", async () => {
    status.mockResolvedValue({
      status: "COMPLETED",
      logs: [{ timestamp: "2026-08-22T02:07:47.580834+00:00", message: "0/180" }],
    } as never);

    const logs = await fetchMusicLogs("req_1");

    expect(status).toHaveBeenCalledWith("minimax/music-3", { requestId: "req_1", logs: true });
    expect(logs).toEqual([{ at: "2026-08-22T02:07:47.580834+00:00", message: "0/180" }]);
  });

  it("returns an empty timeline when the generation never reached fal", async () => {
    const logs = await fetchMusicLogs(null);

    expect(logs).toEqual([]);
    expect(status).not.toHaveBeenCalled();
  });

  it("swallows a fal outage rather than failing the generation read", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    status.mockRejectedValue(new Error("fal is down"));

    await expect(fetchMusicLogs("req_1")).resolves.toEqual([]);

    consoleSpy.mockRestore();
  });

  it("tolerates a response with no logs at all", async () => {
    status.mockResolvedValue({ status: "IN_QUEUE" } as never);

    await expect(fetchMusicLogs("req_1")).resolves.toEqual([]);
  });
});
