import { sendMessage } from "@/lib/telegram/sendMessage";
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
 * Deliberately does not filter internal accounts, unlike the sales
 * notifications. That filter exists so a test signup does not look like
 * revenue; this is observability, where an internal generation is exactly the
 * signal you want — and most current traffic is our own dogfooding.
 *
 * Filtering it cost the first live test of this feature: the generation came
 * from an account whose email is one of the two `isTestEmail` matches, so it
 * completed and notified nobody, silently.
 *
 * @param input - The finished generation.
 */
export async function sendMusicNotification(input: MusicNotificationInput): Promise<void> {
  try {
    await sendMessage(buildMusicNotification(input));
  } catch (error) {
    console.error("Error sending music notification:", error);
  }
}
