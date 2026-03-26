import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { fetchBotMentions, type BotTag } from "@/lib/admins/slack-tags/fetchBotMentions";
import { fetchAllThreadResponses } from "@/lib/admins/slack-tags/fetchAllThreadResponses";
import { fetchThreadPullRequests } from "./fetchThreadPullRequests";

export interface SlackTag extends Omit<BotTag, "responses"> {
  pull_requests: string[];
}

/**
 * Fetches all Slack messages where the Recoup Coding Agent bot was mentioned.
 * Pulls directly from the Slack API using the bot token as the source of truth.
 *
 * @param period - Time period filter: "all", "daily", "weekly", or "monthly"
 * @returns Array of SlackTag objects representing each mention event
 */
export async function fetchSlackMentions(period: AdminPeriod): Promise<SlackTag[]> {
  const botTags = await fetchBotMentions({
    tokenEnvVar: "SLACK_BOT_TOKEN",
    period,
    fetchThreadResponses: (token, threads) =>
      fetchAllThreadResponses(token, threads, fetchThreadPullRequests),
  });

  return botTags.map(({ responses, ...rest }) => ({
    ...rest,
    pull_requests: responses,
  }));
}
