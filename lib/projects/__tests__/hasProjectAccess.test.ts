import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasProjectAccess } from "@/lib/projects/hasProjectAccess";
import { selectProjectCollaborator } from "@/lib/supabase/project_collaborators/selectProjectCollaborator";

vi.mock("@/lib/supabase/project_collaborators/selectProjectCollaborator", () => ({
  selectProjectCollaborator: vi.fn(),
}));

const mocked = vi.mocked(selectProjectCollaborator);

describe("hasProjectAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is true when the account has a collaborator row on the project", async () => {
    mocked.mockResolvedValue({ id: "c1", project_id: "p1", account_id: "a1" });
    await expect(hasProjectAccess("p1", "a1")).resolves.toBe(true);
  });

  it("is false when there is no row", async () => {
    mocked.mockResolvedValue(null);
    await expect(hasProjectAccess("p1", "a1")).resolves.toBe(false);
  });

  it("is false rather than throwing when the lookup fails", async () => {
    // A database error must deny, never open the project up.
    mocked.mockRejectedValue(new Error("connection reset"));
    await expect(hasProjectAccess("p1", "a1")).resolves.toBe(false);
  });
});
