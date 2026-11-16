import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeIngestionScope } from "../authorizeIngestionScope";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
describe("ingestion scope authorization", () => {
  afterEach(() => vi.resetAllMocks());
  const actor = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
  it("normalizes authenticated IDs before comparing organization access", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);
    expect(await authorizeIngestionScope(actor, actor.toLowerCase())).toBe(
      `organization/${actor.toLowerCase()}`,
    );
    expect(validateOrganizationAccess).toHaveBeenCalledWith({
      accountId: actor.toLowerCase(),
      organizationId: actor.toLowerCase(),
    });
  });
  it("keeps personal scopes separate and refuses denied membership", async () => {
    expect(await authorizeIngestionScope(actor)).toBe(`account/${actor.toLowerCase()}`);
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
    await expect(authorizeIngestionScope(actor, actor)).rejects.toThrow("Access denied");
  });
});
