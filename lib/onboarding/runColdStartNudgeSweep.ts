import { COLD_START_NUDGE_EMAIL_LOG_TYPE, WELCOME_EMAIL_LOG_TYPE } from "@/lib/const";
import { sendColdStartNudgeEmail } from "@/lib/emails/sendColdStartNudgeEmail";
import { getColdStartAccountIds } from "@/lib/onboarding/getColdStartAccountIds";
import { selectRosteredAccountIds } from "@/lib/supabase/account_artist_ids/selectRosteredAccountIds";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Wait a day before nudging: below that, the user may still be mid-setup. */
const MIN_AGE_DAYS = 1;
/** Stop after two weeks: past that the nudge reads as spam, not a reminder. */
const MAX_AGE_DAYS = 14;

export interface ColdStartNudgeSweepResult {
  welcomed: number;
  coldStart: number;
  sent: number;
}

/**
 * Finds accounts that were welcomed but never added an artist, and nudges them
 * once (chat#1889).
 *
 * Two thirds of the first welcome-email cohort were cold-start: the welcome
 * fires on account creation whether or not a valuation preceded it, so those
 * accounts were told to confirm a roster and view a valuation that did not
 * exist. Detection is a scheduled sweep because there is no event to hang it
 * on — the signal is the ABSENCE of a roster some time later.
 *
 * Dedupe is the `cold_start_nudge_email` marker in `email_send_log`, so a
 * re-run (or a cron retry) cannot double-send.
 *
 * @param now - Current time, injected so the window is testable.
 */
export async function runColdStartNudgeSweep(
  now: Date = new Date(),
): Promise<ColdStartNudgeSweepResult> {
  const welcomeRows = await selectEmailSendLog({
    status: "sent",
    rawBodyLike: `"type":"${WELCOME_EMAIL_LOG_TYPE}"`,
    createdAfter: new Date(now.getTime() - MAX_AGE_DAYS * DAY_MS).toISOString(),
    createdBefore: new Date(now.getTime() - MIN_AGE_DAYS * DAY_MS).toISOString(),
  });

  const welcomedAccountIds = welcomeRows
    .map(row => row.account_id)
    .filter((id): id is string => !!id);

  if (welcomedAccountIds.length === 0) {
    return { welcomed: 0, coldStart: 0, sent: 0 };
  }

  const [rosteredAccountIds, nudgedRows] = await Promise.all([
    selectRosteredAccountIds(welcomedAccountIds),
    selectEmailSendLog({
      status: "sent",
      rawBodyLike: `"type":"${COLD_START_NUDGE_EMAIL_LOG_TYPE}"`,
    }),
  ]);

  const coldStart = getColdStartAccountIds({
    welcomedAccountIds,
    rosteredAccountIds,
    alreadyNudgedAccountIds: nudgedRows
      .map(row => row.account_id)
      .filter((id): id is string => !!id),
  });

  let sent = 0;
  for (const accountId of coldStart) {
    // Sequential on purpose: a nudge sweep has no latency requirement, and this
    // keeps the send rate gentle.
    if (await sendColdStartNudgeEmail({ accountId })) sent += 1;
  }

  return {
    welcomed: new Set(welcomedAccountIds).size,
    coldStart: coldStart.length,
    sent,
  };
}
