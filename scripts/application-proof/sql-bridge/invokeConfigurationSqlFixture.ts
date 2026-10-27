import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { rehearseConfigurationInvocation } from "../rehearseConfigurationInvocation";

type Plan = Awaited<ReturnType<typeof rehearseConfigurationInvocation>>["plan"];
const receiptSchema = z
  .object({
    receipt_id: z.string().uuid(),
    actor: z.string().uuid(),
    workspace_id: z.string().uuid(),
    application_id: z.string().uuid(),
    environment: z.enum(["development", "production"]),
    operation: z.literal("replace_existing_origin_return_urls"),
    recorded_at: z.iso.datetime({ offset: true }),
    before: z.unknown(),
    changes: z.unknown(),
    after: z.unknown(),
    access_activated: z.literal(false),
    bootstrap_enabled: z.literal(false),
    production_persisted: z.literal(false),
    evidence_kind: z.literal("synthetic_configuration"),
  })
  .strict();

/** Offline SQL receipt bridge. Caller retains the original plan/key on uncertain outcome. */
export async function invokeConfigurationSqlFixture(
  originalPlan: Plan,
  originalKey: string,
  executeFixtureSql?: (sql: string) => Promise<string>,
) {
  z.string().min(1).max(128).parse(originalKey);
  if (!executeFixtureSql) throw new Error("Fixture SQL transport unavailable");
  const plan = structuredClone(originalPlan);
  const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  const scope = plan.scope;
  const parameters = [
    scope.actor_id,
    scope.workspace_id,
    scope.application_id,
    scope.environment,
    originalKey,
  ].map(quote);
  parameters.push(
    quote(JSON.stringify(plan.expected_snapshot)) + "::jsonb",
    quote(JSON.stringify(plan.changes)) + "::jsonb",
  );
  // SQL owns idempotency and the receipt. No retry, generated key, or local receipt substitute.
  const raw = await executeFixtureSql(
    `SELECT application_proof_proposal.configure_return_urls(${parameters.join(",")});`,
  );
  const receipt = receiptSchema.parse(JSON.parse(raw));
  if (
    receipt.actor !== scope.actor_id ||
    receipt.workspace_id !== scope.workspace_id ||
    receipt.application_id !== scope.application_id ||
    receipt.environment !== scope.environment ||
    receipt.operation !== scope.operation ||
    !isDeepStrictEqual(receipt.before, plan.expected_snapshot) ||
    !isDeepStrictEqual(receipt.changes, plan.changes)
  )
    throw new Error("SQL receipt binding mismatch");
  const after = structuredClone(plan.expected_snapshot);
  const changed = new Map(plan.changes.map(change => [change.origin, change]));
  after.origins = after.origins.map(entry => {
    const change = changed.get(entry.origin);
    return change ? { origin: entry.origin, revoked: entry.revoked, ...change.next } : entry;
  });
  after.return_urls = [
    ...after.return_urls.filter(url => !changed.has(new URL(url).origin)),
    ...plan.changes.flatMap(change => change.return_urls),
  ].sort();
  if (!isDeepStrictEqual(receipt.after, after)) throw new Error("SQL receipt after-state mismatch");
  return {
    receipt,
    acknowledgment: {
      kind: "fixture-only-result" as const,
      persisted: false as const,
      bootstrap_enabled: false as const,
      access_activated: false as const,
      plan,
    },
  };
}
