import { z } from "zod";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";

// UUID case is insignificant; other provider identifiers remain opaque.
function normalizeUuid(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : value;
}

const ownershipSchema = z.object({
  payload: z
    .object({
      accountId: z.string().min(1).optional(),
      account_id: z.string().min(1).optional(),
      externalId: z.string().min(1).optional(),
    })
    .nullish(),
  schedule: z.object({ externalId: z.string().min(1).nullish() }).nullish(),
  tags: z.array(z.string()).nullish(),
});

/** Checks server-returned run ownership; never accepts caller-supplied tags or payloads. */
export async function canReadTaskRun(job: unknown, accountId: string): Promise<boolean> {
  const parsed = ownershipSchema.safeParse(job);
  if (!parsed.success || !accountId) return false;
  const { payload, schedule, tags } = parsed.data;
  const ownerAccountId = normalizeUuid(accountId);
  const owners = [payload?.accountId, payload?.account_id].filter(
    (owner): owner is string => owner !== undefined,
  );
  if (owners.length) return owners.every(owner => normalizeUuid(owner) === ownerAccountId);

  const taskIds = [payload?.externalId, schedule?.externalId]
    .filter((id): id is string => typeof id === "string")
    .map(normalizeUuid);
  if (new Set(taskIds).size > 1) return false;
  const externalId = taskIds[0];
  if (externalId) {
    const tasks = await selectScheduledActions({ id: externalId, account_id: ownerAccountId });
    return tasks.some(
      task =>
        normalizeUuid(task.id) === externalId && normalizeUuid(task.account_id) === ownerAccountId,
    );
  }

  // Legacy workers attach account tags after resolving the saved task's owner.
  const accountTags = (tags ?? []).filter(tag => tag.startsWith("account:"));
  return (
    accountTags.length > 0 &&
    accountTags.every(tag => normalizeUuid(tag.slice("account:".length)) === ownerAccountId)
  );
}
