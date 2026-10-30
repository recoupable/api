import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { applicationRegistrationSchema } from "@/lib/applications/applicationRegistrationSchema";
import { validateApplicationRegistration } from "@/lib/applications/validateApplicationRegistration";

const revision = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER - 1);
const revisions = z
  .object({ config_revision: revision, proof_revision: revision, cas_revision: revision })
  .strict();
const snapshotSchema = applicationRegistrationSchema
  .omit({ organization_id: true })
  .extend({
    workspace_id: z.string().uuid(),
    application_id: z.string().uuid(),
    origins: z
      .array(revisions.extend({ origin: z.string(), revoked: z.boolean() }).strict())
      .min(1)
      .max(32),
  })
  .strict();
type Scope = {
  actor_id: string;
  workspace_id: string;
  application_id: string;
  environment: "development" | "production";
  operation: "replace_existing_origin_return_urls";
};
type Plan = {
  scope: Scope;
  expected_snapshot: z.infer<typeof snapshotSchema>;
  changes: Array<{
    origin: string;
    expected: z.infer<typeof revisions>;
    next: z.infer<typeof revisions>;
    return_urls: string[];
  }>;
};
interface FixtureAdapters {
  authorizeFixture?: (scope: Scope) => Promise<unknown>;
  readFixtureSnapshot?: (scope: Scope) => Promise<unknown>;
  invokeFixture?: (plan: Plan) => Promise<unknown>;
}

/** Offline rehearsal only. No runtime caller, default authority, database or activation. */
export async function rehearseConfigurationInvocation(
  authenticatedAccountId: string,
  selectedApplicationId: string,
  input: unknown,
  fixtures: FixtureAdapters = {},
) {
  z.string().uuid().parse(authenticatedAccountId);
  z.string().uuid().parse(selectedApplicationId);
  const proposal = await validateApplicationRegistration(authenticatedAccountId, input);
  const scope: Scope = {
    actor_id: authenticatedAccountId,
    workspace_id: proposal.workspace_id,
    application_id: selectedApplicationId,
    environment: proposal.environment,
    operation: "replace_existing_origin_return_urls",
  };
  const decision = await fixtures.authorizeFixture?.(structuredClone(scope));
  if (!isDeepStrictEqual(decision, { kind: "fixture-only-authority", scope }))
    throw new Error("Management authority unavailable");
  if (!fixtures.readFixtureSnapshot) throw new Error("Parent snapshot unavailable");
  const current = snapshotSchema.parse(await fixtures.readFixtureSnapshot(structuredClone(scope)));
  if (
    current.workspace_id !== scope.workspace_id ||
    current.application_id !== scope.application_id ||
    current.environment !== scope.environment
  )
    throw new Error("Parent binding mismatch");
  // Reuse the real canonical-origin/return-URL checks for the synthetic saved configuration too.
  await validateApplicationRegistration(authenticatedAccountId, {
    name: current.name,
    organization_id: current.workspace_id,
    environment: current.environment,
    allowed_origins: current.allowed_origins,
    return_urls: current.return_urls,
  });
  const sort = (values: string[]) => [...values].sort();
  current.allowed_origins = sort(current.allowed_origins);
  current.return_urls = sort(current.return_urls);
  current.origins.sort((a, b) => (a.origin < b.origin ? -1 : a.origin > b.origin ? 1 : 0));
  if (
    !isDeepStrictEqual(
      current.origins.map(value => value.origin),
      current.allowed_origins,
    ) ||
    current.origins.some(value => value.revoked)
  )
    throw new Error("Parent origins unavailable");
  if (
    proposal.name !== current.name ||
    !isDeepStrictEqual(sort(proposal.allowed_origins), current.allowed_origins)
  )
    throw new Error("Parent registry operation required");
  const urlsFor = (values: string[], origin: string) =>
    sort(values.filter(value => new URL(value).origin === origin));
  const plan: Plan = { scope, expected_snapshot: current, changes: [] };
  for (const entry of current.origins) {
    const returnUrls = urlsFor(proposal.return_urls, entry.origin);
    if (isDeepStrictEqual(returnUrls, urlsFor(current.return_urls, entry.origin))) continue;
    const expected = revisions.parse({
      config_revision: entry.config_revision,
      proof_revision: entry.proof_revision,
      cas_revision: entry.cas_revision,
    });
    plan.changes.push({
      origin: entry.origin,
      expected,
      next: {
        ...expected,
        config_revision: expected.config_revision + 1,
        cas_revision: expected.cas_revision + 1,
      },
      return_urls: returnUrls,
    });
  }
  const result = {
    kind: "fixture-only-result" as const,
    persisted: false as const,
    bootstrap_enabled: false as const,
    access_activated: false as const,
    plan,
  };
  if (!plan.changes.length) return result;
  if (!fixtures.invokeFixture) throw new Error("Fixture invoker unavailable");
  const observed = await fixtures.invokeFixture(structuredClone(plan));
  if (!isDeepStrictEqual(observed, result)) throw new Error("Invalid fixture result");
  return result;
}
