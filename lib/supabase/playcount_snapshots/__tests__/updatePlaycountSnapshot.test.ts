import { describe, it, expect, vi, beforeEach } from "vitest";
import { updatePlaycountSnapshot } from "../updatePlaycountSnapshot";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { default: { from: mockFrom, rpc: mockRpc } };
});

describe("updatePlaycountSnapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates snapshot fields by id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await updatePlaycountSnapshot("snap_1", { state: "running" });

    expect(update).toHaveBeenCalledWith({ state: "running" });
    expect(eq).toHaveBeenCalledWith("id", "snap_1");
  });

  it("throws on update error", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await expect(updatePlaycountSnapshot("snap_1", { state: "done" })).rejects.toThrow(
      "Failed to update playcount snapshot: boom",
    );
  });
});
