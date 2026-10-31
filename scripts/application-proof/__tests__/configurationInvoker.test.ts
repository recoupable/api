import { beforeEach, describe, expect, it, vi } from "vitest";
import { rehearseConfigurationInvocation } from "../rehearseConfigurationInvocation";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

const account = "00000000-0000-4000-8000-000000000001";
const application = "00000000-0000-4000-8000-000000000002";
const organization = "00000000-0000-4000-8000-000000000003";
const origin = "https://music.example";
const second = "https://other.example";
const input = () => ({
  name: "Music",
  environment: "production",
  allowed_origins: [origin, second],
  return_urls: [origin + "/done", second + "/done"],
});
const snapshot = () => ({
  workspace_id: account,
  application_id: application,
  ...input(),
  origins: [
    { origin, config_revision: 4, proof_revision: 7, cas_revision: 12, revoked: false },
    { origin: second, config_revision: 2, proof_revision: 3, cas_revision: 5, revoked: false },
  ],
});
const adapters = () => ({
  authorizeFixture: vi.fn(async (scope: unknown) => ({ kind: "fixture-only-authority", scope })),
  readFixtureSnapshot: vi.fn(async () => snapshot()),
  invokeFixture: vi.fn(async (plan: unknown) => ({
    kind: "fixture-only-result",
    persisted: false,
    bootstrap_enabled: false,
    access_activated: false,
    plan,
  })),
});

beforeEach(() => vi.mocked(validateOrganizationAccess).mockResolvedValue(true));

describe("registration-shaped offline configuration invocation", () => {
  it("defaults to denial even after real preflight succeeds, including workspace membership", async () => {
    for (const proposal of [input(), { ...input(), organization_id: organization }]) {
      const readFixtureSnapshot = vi.fn();
      const invokeFixture = vi.fn();
      await expect(
        rehearseConfigurationInvocation(account, application, proposal, {
          readFixtureSnapshot,
          invokeFixture,
        }),
      ).rejects.toThrow("Management authority unavailable");
      expect(readFixtureSnapshot).not.toHaveBeenCalled();
      expect(invokeFixture).not.toHaveBeenCalled();
    }
  });
  it("rejects truthy, missing, mismatched and throwing authority decisions", async () => {
    for (const answer of [true, undefined, {}, { kind: "fixture-only-authority", scope: {} }]) {
      const deps = adapters();
      deps.authorizeFixture = vi.fn(async () => answer) as typeof deps.authorizeFixture;
      await expect(
        rehearseConfigurationInvocation(account, application, input(), deps),
      ).rejects.toThrow("Management authority unavailable");
      expect(deps.readFixtureSnapshot).not.toHaveBeenCalled();
      expect(deps.invokeFixture).not.toHaveBeenCalled();
    }
    const deps = adapters();
    deps.authorizeFixture.mockRejectedValue(new Error("fixture policy unavailable"));
    await expect(
      rehearseConfigurationInvocation(account, application, input(), deps),
    ).rejects.toThrow("fixture policy unavailable");
    expect(deps.invokeFixture).not.toHaveBeenCalled();
  });
  it("rejects a decision altered in any authority scope field", async () => {
    for (const field of [
      "actor_id",
      "workspace_id",
      "application_id",
      "environment",
      "operation",
    ]) {
      const deps = adapters();
      deps.authorizeFixture = vi.fn(async (scope: unknown) => ({
        kind: "fixture-only-authority",
        scope: { ...(scope as object), [field]: "wrong" },
      }));
      await expect(
        rehearseConfigurationInvocation(account, application, input(), deps),
      ).rejects.toThrow("Management authority unavailable");
      expect(deps.readFixtureSnapshot).not.toHaveBeenCalled();
      expect(deps.invokeFixture).not.toHaveBeenCalled();
    }
  });
  it("isolates the comparison baseline from a mutating fixture adapter", async () => {
    const deps = adapters();
    deps.invokeFixture = vi.fn(async (plan: unknown) => {
      const altered = plan as { changes: Array<{ next: { proof_revision: number } }> };
      altered.changes[0].next.proof_revision++;
      return {
        kind: "fixture-only-result",
        persisted: false,
        bootstrap_enabled: false,
        access_activated: false,
        plan,
      };
    });
    await expect(
      rehearseConfigurationInvocation(
        account,
        application,
        { ...input(), return_urls: [origin + "/new", second + "/done"] },
        deps,
      ),
    ).rejects.toThrow("Invalid fixture result");
  });
  it("uses the real preflight to reject spoofed origins and caller-injected ownership", async () => {
    for (const proposal of [
      { ...input(), allowed_origins: [origin + "/"] },
      { ...input(), account_id: account },
      { ...input(), application_id: application },
      { ...input(), billing_owner_id: account },
      { ...input(), return_urls: ["https://foreign.example/done"] },
    ]) {
      const deps = adapters();
      await expect(
        rehearseConfigurationInvocation(account, application, proposal, deps),
      ).rejects.toThrow();
      expect(deps.authorizeFixture).not.toHaveBeenCalled();
      expect(deps.invokeFixture).not.toHaveBeenCalled();
    }
  });
  it("maps only affected return URLs to config/CAS increments, preserving proof revision", async () => {
    const deps = adapters();
    const result = await rehearseConfigurationInvocation(
      account,
      application,
      { ...input(), return_urls: [origin + "/new?source=site", second + "/done"] },
      deps,
    );
    expect(deps.invokeFixture).toHaveBeenCalledOnce();
    expect(result.plan.changes).toEqual([
      {
        origin,
        expected: { config_revision: 4, proof_revision: 7, cas_revision: 12 },
        next: { config_revision: 5, proof_revision: 7, cas_revision: 13 },
        return_urls: [origin + "/new?source=site"],
      },
    ]);
    expect(result.persisted).toBe(false);
    expect(result.bootstrap_enabled).toBe(false);
    expect(result.access_activated).toBe(false);
  });
  it("projects both affected origins once, including an empty return destination list", async () => {
    const deps = adapters();
    const result = await rehearseConfigurationInvocation(
      account,
      application,
      { ...input(), allowed_origins: [second, origin], return_urls: [second + "/new"] },
      deps,
    );
    expect(deps.invokeFixture).toHaveBeenCalledOnce();
    expect(result.plan.expected_snapshot).toEqual(snapshot());
    expect(result.plan.changes).toEqual([
      {
        origin,
        expected: { config_revision: 4, proof_revision: 7, cas_revision: 12 },
        next: { config_revision: 5, proof_revision: 7, cas_revision: 13 },
        return_urls: [],
      },
      {
        origin: second,
        expected: { config_revision: 2, proof_revision: 3, cas_revision: 5 },
        next: { config_revision: 3, proof_revision: 3, cas_revision: 6 },
        return_urls: [second + "/new"],
      },
    ]);
  });
  it("treats reordered sets as no change and never invokes an empty mutation", async () => {
    const deps = adapters();
    const result = await rehearseConfigurationInvocation(
      account,
      application,
      {
        ...input(),
        allowed_origins: [second, origin],
        return_urls: [second + "/done", origin + "/done"],
      },
      deps,
    );
    expect(result.plan.changes).toEqual([]);
    expect(deps.invokeFixture).not.toHaveBeenCalled();
  });
  it("fails closed for absent parent, changed binding, terminal origins or malformed revisions", async () => {
    for (const state of [
      undefined,
      { ...snapshot(), workspace_id: organization },
      { ...snapshot(), application_id: account },
      { ...snapshot(), environment: "development" },
      { ...snapshot(), origins: [] },
      {
        ...snapshot(),
        origins: [{ ...snapshot().origins[0], revoked: true }, snapshot().origins[1]],
      },
      {
        ...snapshot(),
        origins: [{ ...snapshot().origins[0], cas_revision: 0 }, snapshot().origins[1]],
      },
    ]) {
      const deps = adapters();
      deps.readFixtureSnapshot = vi.fn(async () => state) as typeof deps.readFixtureSnapshot;
      await expect(
        rehearseConfigurationInvocation(account, application, input(), deps),
      ).rejects.toThrow();
      expect(deps.invokeFixture).not.toHaveBeenCalled();
    }
  });
  it("refuses new/removed origins and name changes until parent registry operations exist", async () => {
    for (const proposal of [
      { ...input(), allowed_origins: [origin], return_urls: [origin + "/done"] },
      { ...input(), allowed_origins: [origin, second, "https://new.example"] },
      { ...input(), name: "Renamed" },
    ]) {
      const deps = adapters();
      await expect(
        rehearseConfigurationInvocation(account, application, proposal, deps),
      ).rejects.toThrow("Parent registry operation required");
      expect(deps.invokeFixture).not.toHaveBeenCalled();
    }
  });
  it("propagates stale/absent invoker failures and rejects activation or altered result claims", async () => {
    const proposal = { ...input(), return_urls: [origin + "/new", second + "/done"] };
    const absent = adapters();
    await expect(
      rehearseConfigurationInvocation(account, application, proposal, {
        ...absent,
        invokeFixture: undefined,
      }),
    ).rejects.toThrow("Fixture invoker unavailable");
    for (const error of [
      new Error("revision conflict"),
      new Error("authority revoked at commit"),
    ]) {
      const deps = adapters();
      deps.invokeFixture.mockRejectedValue(error);
      await expect(
        rehearseConfigurationInvocation(account, application, proposal, deps),
      ).rejects.toThrow(error.message);
    }
    for (const patch of [
      { persisted: true },
      { bootstrap_enabled: true },
      { access_activated: true },
      { plan: {} },
    ]) {
      const deps = adapters();
      deps.invokeFixture = vi.fn(async (plan: unknown) => ({
        kind: "fixture-only-result",
        persisted: false,
        bootstrap_enabled: false,
        access_activated: false,
        plan,
        ...patch,
      }));
      await expect(
        rehearseConfigurationInvocation(account, application, proposal, deps),
      ).rejects.toThrow("Invalid fixture result");
    }
  });
});
