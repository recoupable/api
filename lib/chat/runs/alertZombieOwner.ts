import { getLatestUserMessageAt } from "@/lib/supabase/chat_messages/getLatestUserMessageAt";
import { isOwnerInactive, ZOMBIE_OWNER_INACTIVE_DAYS } from "@/lib/chat/runs/isOwnerInactive";
import { markZombieOwnerAlerted } from "@/lib/chat/runs/markZombieOwnerAlerted";
import { sendMessage } from "@/lib/telegram/sendMessage";

export type ZombieOwnerAlertParams = {
  /** Account whose scheduled run just started. */
  accountId: string;
  /** Chat the run belongs to. */
  chatId: string;
  /** Session the run belongs to. */
  sessionId: string;
};

/**
 * Alert-only zombie-owner check for scheduled runs (recoupable/chat#1885).
 *
 * `handleStartChatRun` starts scheduled runs with no check that a human still
 * uses the account. This fires a DEDUPED Telegram alert when the owner's last
 * `role='user'` message is older than {@link ZOMBIE_OWNER_INACTIVE_DAYS} days
 * (or they've never sent one). The run is NOT blocked — this only surfaces
 * accounts that keep generating long after the human left.
 *
 * Dedup: a per-owner Redis marker (`markZombieOwnerAlerted`) so daily runs for
 * the same dormant account alert at most once per window. Never throws —
 * schedule it via `after()` so it can't break the run or delay the response.
 */
export async function alertZombieOwner(params: ZombieOwnerAlertParams): Promise<void> {
  const { accountId, chatId, sessionId } = params;

  try {
    const lastUserMessageAt = await getLatestUserMessageAt(accountId);
    if (!isOwnerInactive(lastUserMessageAt, new Date())) return;

    // Dedup before sending so repeated scheduled runs don't spam.
    const shouldSend = await markZombieOwnerAlerted(accountId);
    if (!shouldSend) return;

    const lastSeen = lastUserMessageAt ?? "never";
    const text = [
      "🧟 *Zombie-owner scheduled run*",
      "",
      `*Account:* ${accountId}`,
      `*Chat:* ${chatId}`,
      `*Session:* ${sessionId}`,
      `*Last user message:* ${lastSeen}`,
      "",
      `No human \`role='user'\` message in > ${ZOMBIE_OWNER_INACTIVE_DAYS} days, but scheduled runs are still firing.`,
      `*Time:* ${new Date().toISOString()}`,
    ].join("\n");

    await sendMessage(text, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("[alertZombieOwner] failed (non-blocking):", error);
  }
}
