"use step";

import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { sendMusicNotification } from "@/lib/music/sendMusicNotification";
import type { MusicNotificationInput } from "@/lib/music/buildMusicNotification";

/**
 * Tells the admin Telegram chat that a generation finished.
 *
 * Its own step so a Telegram hiccup is retried in isolation rather than
 * replaying the fal call or the storage write above it. Never throws either
 * way: the song is already stored and charged by the time this runs, and
 * failing here would retry work that succeeded.
 *
 * @param input - The finished generation, minus the account email, which is
 *   looked up here rather than threaded through the workflow arguments.
 */
export async function notifyMusicGenerationStep(
  accountId: string,
  input: Omit<MusicNotificationInput, "accountEmail">,
): Promise<void> {
  try {
    const emails = await selectAccountEmails({ accountIds: accountId });

    await sendMusicNotification({ ...input, accountEmail: emails[0]?.email ?? null });
  } catch (error) {
    console.error("Error notifying music generation:", error);
  }
}
