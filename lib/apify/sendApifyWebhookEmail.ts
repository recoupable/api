import generateText from "@/lib/ai/generateText";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import type { ApifyInstagramProfileResult } from "@/lib/apify/types";

/**
 * Sends an Apify-webhook summary email to the given recipients using
 * Resend. Generates the email body via an LLM based on the first
 * profile result.
 *
 * @param profile - First dataset result from the profile scraper.
 * @param emails - Recipient email addresses.
 * @returns The Resend response, or `null` when there are no recipients.
 */
export async function sendApifyWebhookEmail(
  profile: ApifyInstagramProfileResult,
  emails: string[],
) {
  if (!emails?.length) return null;

  const prompt = `You have a new Apify dataset update. Here is the data:

Key Data
Full Name: ${profile.fullName}
Username: ${profile.username}
Profile URL: ${profile.url}
Profile Picture: ${profile.profilePicUrl}
Biography: ${profile.biography}
Followers: ${profile.followersCount}
Following: ${profile.followsCount}
Latest Posts: ${(profile.latestPosts ?? []).map(p => JSON.stringify(p)).join(", ")}
`;

  const { text } = await generateText({
    system: `you are a record label services manager for Recoup.
      write beautiful html email.
      subject: New Apify Dataset Notification. you're notifying music managers about new posts being available for one of their roster musician's Instagram profile.
      include a link to view the instagram profile.
      call to action is to open a chat link to learn more about the latest posts using Recoup Chat (AI Agents): https://chat.recoupable.com/?q=tell%20me%20about%20my%20latest%20Ig%20posts
      You'll be passed a dataset summary for a musician profile and their latest posts on instagram.
      your goal is to get the recipient to click a cta link to open a chat link to learn more about the latest posts using Recoup Chat (AI Agents).
      only include the email body html.
      no headers or subject`,
    prompt,
  });

  return await sendEmailWithResend({
    from: RECOUP_FROM_EMAIL,
    to: emails,
    subject: `${profile.fullName ?? profile.username ?? "Your artist"} has new posts on Instagram`,
    html: text,
  });
}
