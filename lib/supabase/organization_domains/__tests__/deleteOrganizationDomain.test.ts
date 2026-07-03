import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteOrganizationDomain } from "../deleteOrganizationDomain";

import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return {
    default: { from: mockFrom },
  };
});

describe("deleteOrganizationDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes by organization_id and domain and returns true", async () => {
    const eqDomainFn = vi.fn().mockResolvedValue({ error: null });
    const eqOrgFn = vi.fn().mockReturnValue({ eq: eqDomainFn });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqOrgFn });
    vi.mocked(supabase.from).mockReturnValue({ delete: deleteFn } as never);

    const result = await deleteOrganizationDomain({
      domain: "seekermusic.com",
      organizationId: "org-1",
    });

    expect(supabase.from).toHaveBeenCalledWith("organization_domains");
    expect(eqOrgFn).toHaveBeenCalledWith("organization_id", "org-1");
    expect(eqDomainFn).toHaveBeenCalledWith("domain", "seekermusic.com");
    expect(result).toBe(true);
  });

  it("returns false on delete error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const eqDomainFn = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const eqOrgFn = vi.fn().mockReturnValue({ eq: eqDomainFn });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqOrgFn });
    vi.mocked(supabase.from).mockReturnValue({ delete: deleteFn } as never);

    const result = await deleteOrganizationDomain({
      domain: "seekermusic.com",
      organizationId: "org-1",
    });

    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
