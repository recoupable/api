import { describe, it, expect, beforeEach, vi } from "vitest";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { createRepository } from "@/lib/github/createRepository";

vi.mock("@/lib/github/repositoryExists", () => ({
  repositoryExists: vi.fn(),
}));
vi.mock("@/lib/github/createRepository", () => ({
  createRepository: vi.fn(),
}));

const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

describe("ensurePersonalRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing repo URL when recoupable/<accountId> already exists", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(true);

    const result = await ensurePersonalRepo({ accountId });

    expect(result).toBe(`https://github.com/recoupable/${accountId}`);
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("returns null when the existence check fails for non-404 reasons", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(null);

    expect(await ensurePersonalRepo({ accountId })).toBeNull();
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("creates a fresh repo when none exists and returns its URL", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(createRepository).mockResolvedValue({
      success: true,
      repoUrl: `https://github.com/recoupable/${accountId}`,
    });

    const result = await ensurePersonalRepo({ accountId });

    expect(createRepository).toHaveBeenCalledWith({ name: accountId });
    expect(result).toBe(`https://github.com/recoupable/${accountId}`);
  });

  it("returns null when creation outright fails", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(createRepository).mockResolvedValue({
      success: false,
      error: "Permission denied",
    });

    expect(await ensurePersonalRepo({ accountId })).toBeNull();
  });
});
