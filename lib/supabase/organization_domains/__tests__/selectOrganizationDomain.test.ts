import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectOrganizationDomain } from "../selectOrganizationDomain";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("selectOrganizationDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects a domain mapping row by domain", async () => {
    const row = {
      id: "dom-1",
      domain: "seekermusic.com",
      organization_id: "org-1",
      created_at: "2026-01-01",
    };
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: row, error: null });
    const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
    } as never);

    const result = await selectOrganizationDomain("seekermusic.com");

    expect(supabase.from).toHaveBeenCalledWith("organization_domains");
    expect(eqFn).toHaveBeenCalledWith("domain", "seekermusic.com");
    expect(result).toEqual(row);
  });

  it("returns null when the domain is not mapped", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
    } as never);

    const result = await selectOrganizationDomain("unmapped.com");

    expect(result).toBeNull();
  });

  it("returns null on query error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
    } as never);

    const result = await selectOrganizationDomain("seekermusic.com");

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
