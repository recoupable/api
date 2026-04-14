export interface SlackAttachment {
  actions?: Array<{
    type?: string;
    text?: string;
    url?: string;
  }>;
}

export interface SlackBlock {
  type: string;
  elements?: Array<{
    type: string;
    url?: string;
    elements?: Array<{
      type: string;
      url?: string;
    }>;
  }>;
}

const PR_URL_PATTERN = /https:\/\/github\.com\/[^\s>|]+\/pull\/\d+/g;
const PR_URL_EXACT = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;

/**
 * Extract Github Pr Urls.
 *
 * @param text - Parameter.
 * @param attachments - Parameter.
 * @param blocks - Parameter.
 * @returns - Result.
 */
export function extractGithubPrUrls(
  text: string,
  attachments?: SlackAttachment[],
  blocks?: SlackBlock[],
): string[] {
  const urls: string[] = [];

  // Extract from message text
  const textMatches = text.match(PR_URL_PATTERN) ?? [];
  urls.push(...textMatches);

  // Extract from attachment action button URLs
  if (attachments) {
    for (const attachment of attachments) {
      for (const action of attachment.actions ?? []) {
        if (action.url && PR_URL_EXACT.test(action.url)) {
          urls.push(action.url);
        }
      }
    }
  }

  // Extract from Block Kit element URLs
  if (blocks) {
    for (const block of blocks) {
      for (const element of block.elements ?? []) {
        if (element.url && PR_URL_EXACT.test(element.url)) {
          urls.push(element.url);
        }
        for (const nested of element.elements ?? []) {
          if (nested.url && PR_URL_EXACT.test(nested.url)) {
            urls.push(nested.url);
          }
        }
      }
    }
  }

  return [...new Set(urls)];
}
