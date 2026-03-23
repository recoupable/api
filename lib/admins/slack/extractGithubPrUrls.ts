export interface SlackAttachment {
  actions?: Array<{
    type?: string;
    text?: string;
    url?: string;
  }>;
}

const PR_URL_PATTERN = /https:\/\/github\.com\/[^\s>|]+\/pull\/\d+/g;

/**
 * Extracts GitHub pull request URLs from a Slack message's text and attachments.
 * Handles plain URLs, Slack-formatted links, and action button URLs.
 */
export function extractGithubPrUrls(text: string, attachments?: SlackAttachment[]): string[] {
  const urls: string[] = [];

  // Extract from message text
  const textMatches = text.match(PR_URL_PATTERN) ?? [];
  urls.push(...textMatches);

  // Extract from attachment action button URLs
  if (attachments) {
    for (const attachment of attachments) {
      for (const action of attachment.actions ?? []) {
        if (action.url && PR_URL_PATTERN.test(action.url)) {
          urls.push(action.url);
        }
        // Reset lastIndex since we're using the global flag
        PR_URL_PATTERN.lastIndex = 0;
      }
    }
  }

  return [...new Set(urls)];
}
