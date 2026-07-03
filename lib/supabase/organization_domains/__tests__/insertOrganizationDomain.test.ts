import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertOrganizationDomain } from "../insertOrganizationDomain";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("insertOrganizationDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a domain mapping and returns the created row", async () => {
    const row = {
      id: "dom-1",
      domain: "seekermusic.com",
      organization_id: "org-1",
      created_at: "2026-01-01",
    };
    const singleFn = vi.fn().mockResolvedValue({ data: row, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    vi.mocked(supabase.from).mockReturnValue({ insert: insertFn } as never);

    const result = await insertOrganizationDomain({
      domain: "seekermusic.com",
      organizationId: "org-1",
    });

    expect(supabase.from).toHaveBeenCalledWith("organization_domains");
    expect(insertFn).toHaveBeenCalledWith({
      domain: "seekermusic.com",
      organization_id: "org-1",
    });
    expect(result).toEqual(row);
  });

  it("returns null on insert error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    vi.mocked(supabase.from).mockReturnValue({ insert: insertFn } as never);

    const result = await insertOrganizationDomain({
      domain: "seekermusic.com",
      organizationId: "org-1",
    });

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
