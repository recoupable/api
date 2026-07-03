import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectOrganizationDomains } from "../selectOrganizationDomains";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("selectOrganizationDomains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects domains by organization_id", async () => {
    const rows = [
      {
        id: "dom-1",
        domain: "seekermusic.com",
        organization_id: "org-1",
        created_at: "2026-01-01",
      },
    ];
    const orderFn = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
    } as never);

    const result = await selectOrganizationDomains("org-1");

    expect(supabase.from).toHaveBeenCalledWith("organization_domains");
    expect(eqFn).toHaveBeenCalledWith("organization_id", "org-1");
    expect(result).toEqual(rows);
  });

  it("returns [] when the organization has no domains", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
    } as never);

    const result = await selectOrganizationDomains("org-1");

    expect(result).toEqual([]);
  });

  it("returns null on query error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const orderFn = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
    } as never);

    const result = await selectOrganizationDomains("org-1");

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
