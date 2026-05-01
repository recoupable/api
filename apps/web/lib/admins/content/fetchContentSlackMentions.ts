import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { fetchBotMentions, type BotTag } from "@/lib/admins/slack/fetchBotMentions";
import { fetchAllThreadResponses } from "@/lib/admins/slack/fetchAllThreadResponses";
import { fetchThreadVideoFiles } from "./fetchThreadVideoFiles";

export interface ContentSlackTag extends Omit<BotTag, "responses"> {
  video_links: string[];
}

/**
 * Fetches all Slack messages where the Recoup Content Agent bot was mentioned.
 * Pulls directly from the Slack API using the content bot token as the source of truth.
 *
 * @param period - Time period filter: "all", "daily", "weekly", or "monthly"
 * @returns Array of ContentSlackTag objects representing each mention event
 */
export async function fetchContentSlackMentions(period: AdminPeriod): Promise<ContentSlackTag[]> {
  const botTags = await fetchBotMentions({
    tokenEnvVar: "SLACK_CONTENT_BOT_TOKEN",
    period,
    fetchThreadResponses: (token, threads) =>
      fetchAllThreadResponses(token, threads, fetchThreadVideoFiles),
  });

  return botTags.map(({ responses, ...rest }) => ({
    ...rest,
    video_links: responses,
  }));
}
