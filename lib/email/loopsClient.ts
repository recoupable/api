import { LoopsClient } from "loops";

let cachedClient: LoopsClient | null = null;

/**
 * Returns a memoized Loops client for tracking contacts.
 * `LOOPS_API_KEY` must be set in the environment.
 *
 * @returns A singleton `LoopsClient` instance.
 */
export function getLoopsClient(): LoopsClient {
  if (!cachedClient) {
    cachedClient = new LoopsClient(process.env.LOOPS_API_KEY as string);
  }
  return cachedClient;
}
