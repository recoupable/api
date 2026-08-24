import { sendMessage } from "@/lib/telegram/sendMessage";
import { isTestEmail } from "@/lib/emails/isTestEmail";
import {
  buildMusicNotification,
  type MusicNotificationInput,
} from "@/lib/music/buildMusicNotification";

/**
 * Tells the admin Telegram chat that a song finished.
 *
 * Never throws. The generation is already paid for and stored by the time this
 * runs, so a Telegram outage must not fail the workflow and trigger a retry of
 * work that succeeded — the same posture `sendSalesNotification` takes with
 * Stripe webhooks.
 *
 * Skips internal and test accounts, as the sales notifications do, so a test
 * generation does not read like customer activity.
 *
 * @param input - The finished generation.
 */
export async function sendMusicNotification(input: MusicNotificationInput): Promise<void> {
  if (input.accountEmail && isTestEmail(input.accountEmail)) return;

  try {
    await sendMessage(buildMusicNotification(input));
  } catch (error) {
    console.error("Error sending music notification:", error);
  }
}
