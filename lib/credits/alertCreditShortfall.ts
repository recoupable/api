import { sendMessage } from "@/lib/telegram/sendMessage";

export type CreditShortfallAlert = {
  /** Account whose wallet couldn't cover the run (and couldn't auto-recharge). */
  accountId: string;
  /** Chat the blocked run belonged to. */
  chatId: string;
  /** Session the blocked run belonged to. */
  sessionId: string;
};

/**
 * Fire a Telegram alert to the team when a scheduled/agent run is skipped for
 * insufficient credits (the account is out of credits AND auto-recharge failed
 * or is opted out). Surfaces burners that would otherwise drain into a deep
 * negative balance (e.g. WAVS Digital hit -1,563) before we notice.
 *
 * Never throws — a Telegram outage must not turn into a workflow failure. Fire
 * and (best-effort) forget, mirroring `sendSalesNotification`.
 */
export async function alertCreditShortfall(alert: CreditShortfallAlert): Promise<void> {
  const { accountId, chatId, sessionId } = alert;
  const text = [
    "⚠️ *Scheduled run blocked — insufficient credits*",
    "",
    `*Account:* ${accountId}`,
    `*Chat:* ${chatId}`,
    `*Session:* ${sessionId}`,
    "",
    "The account is out of credits and auto-recharge did not cover the run.",
    `*Time:* ${new Date().toISOString()}`,
  ].join("\n");

  try {
    await sendMessage(text, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("[alertCreditShortfall] failed to send Telegram alert:", error);
  }
}
