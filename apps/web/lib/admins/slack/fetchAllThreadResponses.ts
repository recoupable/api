interface ThreadRef {
  channelId: string;
  ts: string;
}

export type ThreadExtractor = (
  token: string,
  channel: string,
  threadTs: string,
) => Promise<string[]>;

/**
 * Fetches responses for multiple Slack threads in parallel batches.
 * Generic over the per-thread extractor (PR URLs, video links, etc.).
 *
 * @param token - Slack bot token
 * @param threads - Array of { channelId, ts } identifying each thread
 * @param extractor - Function that extracts response URLs from a single thread
 * @returns Array of response arrays, one per thread (same order as input)
 */
export async function fetchAllThreadResponses(
  token: string,
  threads: ThreadRef[],
  extractor: ThreadExtractor,
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
      batch.map(t => extractor(token, t.channelId, t.ts)),
    );
    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      results[i + j] = result.status === "fulfilled" ? result.value : [];
    }
  }

  return results;
}
