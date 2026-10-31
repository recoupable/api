import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rehearseConfigurationInvocation } from "../rehearseConfigurationInvocation";
import { invokeConfigurationSqlFixture } from "./invokeConfigurationSqlFixture";
import { fixtureSql } from "./fixtureSql";
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(async () => true),
}));
const actor = "00000000-0000-4000-8000-000000000001";
const app = "00000000-0000-4000-8000-000000000002";
const origin = "https://music.example";
const other = "https://other.example";
const key = "original-configuration-key";
type Plan = Awaited<ReturnType<typeof rehearseConfigurationInvocation>>["plan"];
const input = () => ({
  name: "Music",
  environment: "production",
  allowed_origins: [origin, other],
  return_urls: [other + "/new"],
});
const snapshot = () =>
  JSON.parse(
    fixtureSql(
      `SELECT application_proof_proposal.configuration_snapshot('${actor}','${app}','production');`,
    ),
  );
const transport = vi.fn(async (sql: string) => fixtureSql(sql));
const authorize = async (scope: unknown) => ({ kind: "fixture-only-authority", scope });
const enableSqlAuthority = () =>
  fixtureSql(
    readFileSync(join(process.env.RECOUP_PROOF_BRIDGE_SOCKET!, "fixture-authority.sql"), "utf8"),
  );
const count = () =>
  Number(fixtureSql("SELECT count(*) FROM application_proof_proposal.configuration_receipts;"));

describe.skipIf(!process.env.RECOUP_PROOF_BRIDGE_SOCKET)(
  "pinned actual API to PostgreSQL configuration bridge",
  () => {
    beforeEach(() => {
      transport.mockClear();
      fixtureSql(
        readFileSync(
          join(process.env.RECOUP_PROOF_BRIDGE_SOCKET!, "default-authority.sql"),
          "utf8",
        ),
      );
      fixtureSql(`TRUNCATE proof_parent_fixture.workspaces,proof_parent_fixture.authority CASCADE;
      INSERT INTO proof_parent_fixture.workspaces VALUES('${actor}');
      INSERT INTO proof_parent_fixture.applications(workspace_id,id) VALUES('${actor}','${app}');
      INSERT INTO proof_parent_fixture.environments(workspace_id,application_id,environment) VALUES('${actor}','${app}','production');
      INSERT INTO proof_parent_fixture.origins(workspace_id,application_id,environment,origin,hostname,return_urls)
      VALUES('${actor}','${app}','production','${origin}','music.example',ARRAY['${origin}/done']),
      ('${actor}','${app}','production','${other}','other.example',ARRAY['${other}/done']);
      INSERT INTO proof_parent_fixture.authority VALUES('${actor}','${actor}','${app}','production',ARRAY['replace_existing_origin_return_urls'],true);`);
    });
    it("denies missing API authority before SQL transport", async () => {
      await expect(
        rehearseConfigurationInvocation(actor, app, input(), {
          readFixtureSnapshot: async () => snapshot(),
          invokeFixture: async plan =>
            (await invokeConfigurationSqlFixture(plan, key, transport)).acknowledgment,
        }),
      ).rejects.toThrow("Management authority unavailable");
      expect(transport).not.toHaveBeenCalled();
      expect(count()).toBe(0);
    });
    it("does not convert the API fixture marker into SQL management authority", async () => {
      await expect(
        rehearseConfigurationInvocation(actor, app, input(), {
          authorizeFixture: authorize,
          readFixtureSnapshot: async () => snapshot(),
          invokeFixture: async plan =>
            (await invokeConfigurationSqlFixture(plan, key, transport)).acknowledgment,
        }),
      ).rejects.toThrow("management authority unavailable");
      expect(transport).toHaveBeenCalledOnce();
      expect(count()).toBe(0);
    });
    it("maps actual SQL receipt and full after state to the existing disabled acknowledgment", async () => {
      enableSqlAuthority();
      let receipt: unknown;
      const result = await rehearseConfigurationInvocation(actor, app, input(), {
        authorizeFixture: authorize,
        readFixtureSnapshot: async () => snapshot(),
        invokeFixture: async plan => {
          const bridge = await invokeConfigurationSqlFixture(plan, key, transport);
          receipt = bridge.receipt;
          return bridge.acknowledgment;
        },
      });
      expect(result.plan.changes.map(change => change.return_urls)).toEqual([[], [other + "/new"]]);
      expect(receipt).toMatchObject({
        actor,
        application_id: app,
        workspace_id: actor,
        bootstrap_enabled: false,
        access_activated: false,
        production_persisted: false,
        changes: result.plan.changes,
        before: result.plan.expected_snapshot,
        after: snapshot(),
      });
      expect(snapshot().origins).toEqual(
        [origin, other].map(value => ({
          origin: value,
          config_revision: 2,
          proof_revision: 1,
          cas_revision: 2,
          revoked: false,
        })),
      );
      expect(count()).toBe(1);
    });
    it("round-trips apostrophes through actual canonical validation and SQL literals", async () => {
      enableSqlAuthority();
      const destination = other + "/o'clock?from=artist";
      const result = await rehearseConfigurationInvocation(
        actor,
        app,
        { ...input(), return_urls: [destination] },
        {
          authorizeFixture: authorize,
          readFixtureSnapshot: async () => snapshot(),
          invokeFixture: async plan =>
            (await invokeConfigurationSqlFixture(plan, key, transport)).acknowledgment,
        },
      );
      expect(snapshot().return_urls).toEqual([destination]);
      expect(result.plan.changes[1].return_urls).toEqual([destination]);
      expect(count()).toBe(1);
    });
    it("rejects an absent SQL transport without inventing a result", async () => {
      enableSqlAuthority();
      await expect(
        rehearseConfigurationInvocation(actor, app, input(), {
          authorizeFixture: authorize,
          readFixtureSnapshot: async () => snapshot(),
          invokeFixture: async plan =>
            (await invokeConfigurationSqlFixture(plan, key)).acknowledgment,
        }),
      ).rejects.toThrow("Fixture SQL transport unavailable");
      expect(count()).toBe(0);
    });
    it("propagates a full-snapshot conflict from actual SQL without a blind retry", async () => {
      enableSqlAuthority();
      await expect(
        rehearseConfigurationInvocation(actor, app, input(), {
          authorizeFixture: authorize,
          readFixtureSnapshot: async () => snapshot(),
          invokeFixture: async plan => {
            fixtureSql(
              `UPDATE proof_parent_fixture.origins SET cas_revision=cas_revision+1 WHERE origin='${other}';`,
            );
            return (await invokeConfigurationSqlFixture(plan, key, transport)).acknowledgment;
          },
        }),
      ).rejects.toThrow("snapshot conflict");
      expect(transport).toHaveBeenCalledOnce();
      expect(count()).toBe(0);
    });
    it("propagates SQL authority revocation after the API fixture decision", async () => {
      enableSqlAuthority();
      await expect(
        rehearseConfigurationInvocation(actor, app, input(), {
          authorizeFixture: authorize,
          readFixtureSnapshot: async () => snapshot(),
          invokeFixture: async plan => {
            fixtureSql("UPDATE proof_parent_fixture.authority SET enabled=false;");
            return (await invokeConfigurationSqlFixture(plan, key, transport)).acknowledgment;
          },
        }),
      ).rejects.toThrow("management authority unavailable");
      expect(count()).toBe(0);
    });
    it("recovers a lost committed response with the original plan/key and original receipt", async () => {
      enableSqlAuthority();
      let captured: Plan | undefined;
      const dropResponse = vi.fn(async (sql: string) => {
        fixtureSql(sql);
        throw new Error("outcome unknown: response lost");
      });
      await expect(
        rehearseConfigurationInvocation(actor, app, input(), {
          authorizeFixture: authorize,
          readFixtureSnapshot: async () => snapshot(),
          invokeFixture: async plan => {
            captured = structuredClone(plan);
            return (await invokeConfigurationSqlFixture(plan, key, dropResponse)).acknowledgment;
          },
        }),
      ).rejects.toThrow("outcome unknown");
      expect(dropResponse).toHaveBeenCalledOnce();
      expect(count()).toBe(1);
      const original = JSON.parse(
        fixtureSql("SELECT result FROM application_proof_proposal.configuration_receipts;"),
      );
      const recovered = await invokeConfigurationSqlFixture(captured!, key, transport);
      expect(recovered.receipt).toEqual(original);
      expect(count()).toBe(1);
      expect(fixtureSql("SELECT key FROM application_proof_proposal.configuration_requests;")).toBe(
        key,
      );
      const altered = structuredClone(captured!);
      altered.changes[1].return_urls = [other + "/different"];
      await expect(invokeConfigurationSqlFixture(altered, key, transport)).rejects.toThrow(
        "idempotency conflict",
      );
      expect(count()).toBe(1);
    });
    it("rejects altered real receipts rather than fabricating successful acknowledgments", async () => {
      enableSqlAuthority();
      let plan: Plan | undefined;
      await rehearseConfigurationInvocation(actor, app, input(), {
        authorizeFixture: authorize,
        readFixtureSnapshot: async () => snapshot(),
        invokeFixture: async value => {
          plan = structuredClone(value);
          return (await invokeConfigurationSqlFixture(value, key, transport)).acknowledgment;
        },
      });
      for (const patch of [
        { access_activated: true },
        { production_persisted: true },
        { actor: app },
        { before: {} },
        { after: {} },
        { changes: [] },
      ]) {
        await expect(
          invokeConfigurationSqlFixture(plan!, key, async sql =>
            JSON.stringify({ ...JSON.parse(fixtureSql(sql)), ...patch }),
          ),
        ).rejects.toThrow();
      }
      expect(count()).toBe(1);
    });
    it("rejects malformed real preflight input before invoking SQL", async () => {
      enableSqlAuthority();
      await expect(
        rehearseConfigurationInvocation(
          actor,
          app,
          { ...input(), return_urls: ["https://foreign.example/done"] },
          {
            authorizeFixture: authorize,
            readFixtureSnapshot: async () => snapshot(),
            invokeFixture: async plan =>
              (await invokeConfigurationSqlFixture(plan, key, transport)).acknowledgment,
          },
        ),
      ).rejects.toThrow();
      expect(transport).not.toHaveBeenCalled();
      expect(count()).toBe(0);
    });
  },
);
