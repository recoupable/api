import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { authorizeContextOwner } from "../authorizeContextOwner";
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

const actor = "11111111-1111-4111-8111-111111111111";
const organization = "22222222-2222-4222-8222-222222222222";
describe("context owner authorization", () => {
  beforeEach(() => vi.resetAllMocks());
  it("uses the authenticated account by default", async () => {
    expect(await authorizeContextOwner(actor)).toEqual({
      accountId: actor,
      ownerId: actor,
      organizationId: null,
    });
    expect(validateOrganizationAccess).not.toHaveBeenCalled();
  });
  it("requires membership for organization context", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);
    expect(await authorizeContextOwner(actor, organization)).toMatchObject({
      ownerId: organization,
    });
    expect(validateOrganizationAccess).toHaveBeenCalledWith({
      accountId: actor,
      organizationId: organization,
    });
  });
  it("checks membership again instead of retaining a stale grant", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await authorizeContextOwner(actor, organization);
    await expect(authorizeContextOwner(actor, organization)).rejects.toThrow("Access denied");
  });
  it("fails closed on membership outages", async () => {
    vi.mocked(validateOrganizationAccess).mockRejectedValue(new Error("unavailable"));
    await expect(authorizeContextOwner(actor, organization)).rejects.toThrow();
  });
  it("rejects missing or invalid authenticated identity", async () => {
    await expect(authorizeContextOwner("")).rejects.toThrow();
    await expect(authorizeContextOwner("not-an-account")).rejects.toThrow();
  });
});
