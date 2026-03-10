import { describe, it, expect, vi } from "vitest";

const mockValidateOrganizationAccess = vi.fn();
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: (...args: unknown[]) => mockValidateOrganizationAccess(...args),
}));

const { checkIsAdmin } = await import("../checkIsAdmin");

describe("checkIsAdmin", () => {
  it("returns true when account is a member of the Recoup org", async () => {
    mockValidateOrganizationAccess.mockResolvedValue(true);

    const result = await checkIsAdmin("account-123");

    expect(result).toBe(true);
    expect(mockValidateOrganizationAccess).toHaveBeenCalledWith({
      accountId: "account-123",
      organizationId: "04e3aba9-c130-4fb8-8b92-34e95d43e66b",
    });
  });

  it("returns false when account is not a member of the Recoup org", async () => {
    mockValidateOrganizationAccess.mockResolvedValue(false);

    const result = await checkIsAdmin("outsider-456");

    expect(result).toBe(false);
  });
});
