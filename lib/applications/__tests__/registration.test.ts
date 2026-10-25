import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateApplicationRegistration } from "../validateApplicationRegistration";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
const account = "11111111-1111-4111-8111-111111111111";
const organization = "22222222-2222-4222-8222-222222222222";
const input = {
  name: "Music app",
  environment: "production",
  allowed_origins: ["https://artist.example"],
  return_urls: ["https://artist.example/listen?source=spotify"],
};
beforeEach(() => vi.clearAllMocks());
describe("application registration preflight", () => {
  it("derives personal workspace and billing owner without creating authority", async () => {
    const result = await validateApplicationRegistration(account, input);
    expect(result).toMatchObject({
      status: "validated",
      persisted: false,
      origins_verified: false,
      workspace_id: account,
      billing_owner_id: account,
      environment: "production",
    });
    expect(result).not.toHaveProperty("application_id");
    expect(validateOrganizationAccess).not.toHaveBeenCalled();
  });
  it("uses the authorized organization as the shared billing owner", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);
    const result = await validateApplicationRegistration(account, {
      ...input,
      organization_id: organization,
    });
    expect(result.workspace_id).toBe(organization);
    expect(result.billing_owner_id).toBe(organization);
    expect(validateOrganizationAccess).toHaveBeenCalledWith({
      accountId: account,
      organizationId: organization,
    });
  });
  it("denies unrelated organizations", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
    await expect(
      validateApplicationRegistration(account, { ...input, organization_id: organization }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("requires an authenticated account", async () => {
    await expect(validateApplicationRegistration("", input)).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    "account_id",
    "billing_owner_id",
    "application_id",
    "client_secret",
    "origins_verified",
  ])("rejects caller-supplied %s", async key => {
    await expect(
      validateApplicationRegistration(account, { ...input, [key]: account }),
    ).rejects.toThrow();
  });
  it.each([
    "https://*.example",
    "https://artist.example/path",
    "https://artist.example/",
    "https://artist.example?query",
    "https://artist.example#fragment",
    "https://name:secret@artist.example",
    "http://artist.example",
    "null",
  ])("rejects non-exact/unsafe origin %s", async origin => {
    await expect(
      validateApplicationRegistration(account, { ...input, allowed_origins: [origin] }),
    ).rejects.toThrow();
  });
  it.each([
    "https://evil.example/callback",
    "https://artist.example.evil.example/callback",
    "https://name:secret@artist.example/callback",
    "https://artist.example/callback#token",
  ])("rejects unregistered return destination %s", async url => {
    await expect(
      validateApplicationRegistration(account, { ...input, return_urls: [url] }),
    ).rejects.toThrow();
  });
  it("isolates development loopback origins from production", async () => {
    const local = {
      ...input,
      allowed_origins: ["http://localhost:3000"],
      return_urls: ["http://localhost:3000/callback"],
    };
    await expect(
      validateApplicationRegistration(account, { ...local, environment: "development" }),
    ).resolves.toMatchObject({ environment: "development" });
    await expect(validateApplicationRegistration(account, local)).rejects.toThrow();
  });
  it("does not equate sibling preview origins or different ports", async () => {
    await expect(
      validateApplicationRegistration(account, {
        ...input,
        environment: "development",
        allowed_origins: ["http://localhost:3000"],
        return_urls: ["http://localhost:3001/callback"],
      }),
    ).rejects.toThrow();
  });
  it("rejects duplicates and unbounded address lists", async () => {
    await expect(
      validateApplicationRegistration(account, {
        ...input,
        allowed_origins: [input.allowed_origins[0], input.allowed_origins[0]],
      }),
    ).rejects.toThrow();
    await expect(
      validateApplicationRegistration(account, {
        ...input,
        allowed_origins: Array.from({ length: 33 }, (_, i) => `https://app${i}.example`),
      }),
    ).rejects.toThrow();
  });
});
