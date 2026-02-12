import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectArtistOrganizationIds } from "../selectArtistOrganizationIds";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

import supabase from "../../serverClient";

describe("selectArtistOrganizationIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return organization IDs for an artist", async () => {
    const rows = [{ organization_id: "org-1" }, { organization_id: "org-2" }];
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    } as never);

    const result = await selectArtistOrganizationIds("artist-123");

    expect(supabase.from).toHaveBeenCalledWith("artist_organization_ids");
    expect(result).toEqual(rows);
  });

  it("should return empty array when artist has no organizations", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as never);

    const result = await selectArtistOrganizationIds("artist-123");

    expect(result).toEqual([]);
  });

  it("should return null on database error", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("DB error"),
        }),
      }),
    } as never);

    const result = await selectArtistOrganizationIds("artist-123");

    expect(result).toBeNull();
  });
});
