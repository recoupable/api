import { describe, it, expect, vi, beforeEach } from "vitest";
import { canManageOrganization } from "../canManageOrganization";
import { validateOrganizationAccess } from "../validateOrganizationAccess";
import { isRecoupAdmin } from "../isRecoupAdmin";

vi.mock("../validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

vi.mock("../isRecoupAdmin", () => ({
  isRecoupAdmin: vi.fn(),
}));

describe("canManageOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the account is a member of the organization", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);

    const result = await canManageOrganization({ accountId: "acc-1", organizationId: "org-1" });

    expect(result).toBe(true);
    expect(isRecoupAdmin).not.toHaveBeenCalled();
  });

  it("returns true for a Recoup admin who is not a member", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
    vi.mocked(isRecoupAdmin).mockResolvedValue(true);

    const result = await canManageOrganization({ accountId: "acc-1", organizationId: "org-1" });

    expect(result).toBe(true);
    expect(isRecoupAdmin).toHaveBeenCalledWith("acc-1");
  });

  it("returns false when neither a member nor a Recoup admin", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
    vi.mocked(isRecoupAdmin).mockResolvedValue(false);

    const result = await canManageOrganization({ accountId: "acc-1", organizationId: "org-1" });

    expect(result).toBe(false);
  });
});
