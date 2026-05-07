import { describe, it, expect, vi, beforeEach } from "vitest";
import { findOrgSnapshot } from "@/lib/sandbox/findOrgSnapshot";
import { Snapshot } from "@vercel/sandbox";

vi.mock("@vercel/sandbox", () => ({
  Snapshot: { list: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findOrgSnapshot", () => {
  it("returns the id of the most recent created snapshot", async () => {
    vi.mocked(Snapshot.list).mockResolvedValue({
      snapshots: [
        { id: "snap_A", status: "creating" },
        { id: "snap_B", status: "created" },
        { id: "snap_C", status: "created" },
      ],
    } as never);

    const id = await findOrgSnapshot("org-x");
    // Returns the FIRST created snapshot in the list (sortOrder desc means first = newest).
    expect(id).toBe("snap_B");
  });

  it("calls Snapshot.list with the supplied name and a desc sort order", async () => {
    vi.mocked(Snapshot.list).mockResolvedValue({ snapshots: [] } as never);

    await findOrgSnapshot("org-y");

    expect(Snapshot.list).toHaveBeenCalledWith(
      expect.objectContaining({ name: "org-y", sortOrder: "desc" }),
    );
  });

  it("returns null when no snapshots are in the 'created' state", async () => {
    vi.mocked(Snapshot.list).mockResolvedValue({
      snapshots: [{ id: "snap_pending", status: "creating" }],
    } as never);

    expect(await findOrgSnapshot("org-z")).toBeNull();
  });

  it("returns null when the API returns no snapshots", async () => {
    vi.mocked(Snapshot.list).mockResolvedValue({ snapshots: [] } as never);
    expect(await findOrgSnapshot("org-empty")).toBeNull();
  });

  it("returns null when Snapshot.list throws", async () => {
    vi.mocked(Snapshot.list).mockRejectedValue(new Error("vercel api down"));
    expect(await findOrgSnapshot("org-err")).toBeNull();
  });
});
