import { fetchThreadPullRequests } from "./fetchThreadPullRequests";

interface ThreadRef {
  channelId: string;
  ts: string;
}

/**
 * Fetches pull request URLs for multiple Slack threads in parallel batches.
 *
 * @param token - Slack bot token
 * @param threads - Array of { channelId, ts } identifying each thread
 * @returns Array of PR URL arrays, one per thread (same order as input)
 */
export async function fetchAllThreadPullRequests(
  token: string,
  threads: ThreadRef[],
): Promise<string[][]> {
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1100;
  const results: string[][] = new Array(threads.length).fill([]);

  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
    const batch = threads.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(t => fetchThreadPullRequests(token, t.channelId, t.ts)),
    );
    for (let j = 0; j < batch.length; j++) {
      results[i + j] = batchResults[j];
    }
  }

  return results;
}
