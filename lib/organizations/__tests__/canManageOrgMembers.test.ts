import { describe, it, expect, vi, beforeEach } from "vitest";
import { canManageOrgMembers } from "../canManageOrgMembers";

import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { isRecoupAdmin } from "@/lib/organizations/isRecoupAdmin";

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

vi.mock("@/lib/organizations/isRecoupAdmin", () => ({
  isRecoupAdmin: vi.fn(),
}));

describe("canManageOrgMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the caller is a member of the organization", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);

    const result = await canManageOrgMembers({
      accountId: "account-1",
      organizationId: "org-1",
    });

    expect(result).toBe(true);
    expect(isRecoupAdmin).not.toHaveBeenCalled();
  });

  it("returns true when the caller is not a member but is a Recoup admin", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
    vi.mocked(isRecoupAdmin).mockResolvedValue(true);

    const result = await canManageOrgMembers({
      accountId: "admin-1",
      organizationId: "org-1",
    });

    expect(result).toBe(true);
    expect(isRecoupAdmin).toHaveBeenCalledWith("admin-1");
  });

  it("returns false when the caller is neither a member nor a Recoup admin", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
    vi.mocked(isRecoupAdmin).mockResolvedValue(false);

    const result = await canManageOrgMembers({
      accountId: "stranger-1",
      organizationId: "org-1",
    });

    expect(result).toBe(false);
  });
});
