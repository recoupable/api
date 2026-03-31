import type { SlackAttachment, SlackBlock } from "@/lib/admins/slack/extractGithubPrUrls";

const VIDEO_URL_PATTERN = /https?:\/\/[^\s>|]+/g;

/**
 * Extracts video/media URLs from a Slack bot reply message's text, attachments, and blocks.
 * Filters for common video hosting patterns.
 *
 * @param text - The plain text body of the Slack message to scan for URLs.
 * @param attachments - Optional Slack message attachments whose action button URLs are also scanned.
 * @param blocks - Optional Slack Block Kit blocks whose element URLs are also scanned.
 * @returns A deduplicated array of video/media URLs found across all message surfaces.
 */
export function extractVideoLinks(
  text: string,
  attachments?: SlackAttachment[],
  blocks?: SlackBlock[],
): string[] {
  const urls: string[] = [];

  // Extract all URLs from message text
  const textMatches = text.match(VIDEO_URL_PATTERN) ?? [];
  urls.push(...textMatches);

  // Extract from attachment action button URLs
  if (attachments) {
    for (const attachment of attachments) {
      for (const action of attachment.actions ?? []) {
        if (action.url) {
          urls.push(action.url);
        }
      }
    }
  }

  // Extract from Block Kit element URLs
  if (blocks) {
    for (const block of blocks) {
      for (const element of block.elements ?? []) {
        if (element.url) {
          urls.push(element.url);
        }
        for (const nested of element.elements ?? []) {
          if (nested.url) {
            urls.push(nested.url);
          }
        }
      }
    }
  }

  return [...new Set(urls)];
}
