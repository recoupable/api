import { z } from "zod";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";

const ownershipSchema = z.object({
  payload: z
    .object({
      accountId: z.string().min(1).optional(),
      account_id: z.string().min(1).optional(),
      externalId: z.string().min(1).optional(),
    })
    .nullish(),
  tags: z.array(z.string()).nullish(),
});

/** Checks server-returned run ownership; never accepts caller-supplied tags or payloads. */
export async function canReadTaskRun(job: unknown, accountId: string): Promise<boolean> {
  const parsed = ownershipSchema.safeParse(job);
  if (!parsed.success || !accountId) return false;
  const { payload, tags } = parsed.data;
  const owners = [payload?.accountId, payload?.account_id].filter(
    (owner): owner is string => owner !== undefined,
  );
  if (owners.length) return owners.every(owner => owner === accountId);

  if (payload?.externalId) {
    const tasks = await selectScheduledActions({ id: payload.externalId, account_id: accountId });
    return tasks.some(task => task.id === payload.externalId && task.account_id === accountId);
  }

  // Legacy workers attach account tags after resolving the saved task's owner.
  const accountTags = (tags ?? []).filter(tag => tag.startsWith("account:"));
  return accountTags.length > 0 && accountTags.every(tag => tag === `account:${accountId}`);
}
