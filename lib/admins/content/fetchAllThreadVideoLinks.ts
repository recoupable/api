import { fetchThreadVideoLinks } from "./fetchThreadVideoLinks";

interface ThreadRef {
  channelId: string;
  ts: string;
}

/**
 * Fetches video link URLs for multiple Slack threads in parallel batches.
 *
 * @param token - Slack bot token
 * @param threads - Array of { channelId, ts } identifying each thread
 * @returns Array of video link URL arrays, one per thread (same order as input)
 */
export async function fetchAllThreadVideoLinks(
  token: string,
  threads: ThreadRef[],
): Promise<string[][]> {
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1100;
  const results: string[][] = Array.from({ length: threads.length }, () => []);

  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
    const batch = threads.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(t => fetchThreadVideoLinks(token, t.channelId, t.ts)),
    );
    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      results[i + j] = result.status === "fulfilled" ? result.value : [];
    }
  }

  return results;
}
