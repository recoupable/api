/**
 * In-memory ring buffer for diagnostic stop-path timing logs.
 *
 * Holds the most recent N entries per chatId. Survives only within a single
 * serverless function instance — Vercel may route GET /api/debug/diag-logs
 * to a different instance than the one that ran the workflow, in which case
 * the read returns empty. For preview debugging within one warm instance
 * this is good enough; we deliberately avoid persisting elsewhere.
 */

const MAX_ENTRIES_PER_KEY = 1000;
const buffers = new Map<string, DiagEntry[]>();

export type DiagEntry = {
  ts: number;
  msg: string;
  data?: Record<string, unknown>;
};

/**
 * Append a diag entry under {@link key} AND mirror to stdout. Drops the oldest
 * entry once {@link MAX_ENTRIES_PER_KEY} is reached so the buffer can't grow
 * unboundedly across long-lived runs.
 */
export function diagLog(
  key: string | undefined,
  msg: string,
  data?: Record<string, unknown>,
): void {
  console.log(msg, data ?? "");
  if (!key) return;
  let arr = buffers.get(key);
  if (!arr) {
    arr = [];
    buffers.set(key, arr);
  }
  arr.push({ ts: Date.now(), msg, data });
  if (arr.length > MAX_ENTRIES_PER_KEY) arr.shift();
}

export function diagGet(key: string): DiagEntry[] {
  return buffers.get(key) ?? [];
}

export function diagListKeys(): string[] {
  return Array.from(buffers.keys());
}
