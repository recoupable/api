/**
 * In-memory ring buffer for diagnostic stop-path timing logs.
 *
 * Holds the most recent N entries per chatId. Survives only within a single
 * serverless function instance. The workflow body runs on a different
 * instance than the api, so we ALSO fire-and-forget POST each entry to the
 * api's collector endpoint at {@link DIAG_INGEST_URL} when configured —
 * that way logs from both sides land in the same buffer and can be read
 * via GET /api/debug/diag-logs.
 */

const MAX_ENTRIES_PER_KEY = 1000;
const buffers = new Map<string, DiagEntry[]>();

/**
 * Optional collector URL. When set, every {@link diagLog} call also fires
 * a fire-and-forget POST so workflow-body logs reach the api buffer.
 * Set in workflow code via `setDiagIngestUrl()` once at run start.
 */
let DIAG_INGEST_URL: string | undefined;

export type DiagEntry = {
  ts: number;
  msg: string;
  data?: Record<string, unknown>;
};

/**
 * Point future {@link diagLog} calls at a remote collector. Repeated calls
 * overwrite the URL. Pass `undefined` to disable forwarding.
 *
 * @param url - Collector URL (typically `/api/debug/diag-logs`).
 */
export function setDiagIngestUrl(url: string | undefined): void {
  DIAG_INGEST_URL = url;
}

/**
 * Append a diag entry to the local buffer, mirror to stdout, and forward to
 * the collector when {@link setDiagIngestUrl} has been called. Drops the
 * oldest entry once {@link MAX_ENTRIES_PER_KEY} is reached.
 *
 * @param key - Buffer key (usually chatId). Skipped if undefined.
 * @param msg - Log line.
 * @param data - Optional structured data object.
 */
export function diagLog(
  key: string | undefined,
  msg: string,
  data?: Record<string, unknown>,
): void {
  console.log(msg, data ?? "");
  if (!key) return;
  const entry: DiagEntry = { ts: Date.now(), msg, data };
  let arr = buffers.get(key);
  if (!arr) {
    arr = [];
    buffers.set(key, arr);
  }
  arr.push(entry);
  if (arr.length > MAX_ENTRIES_PER_KEY) arr.shift();
  if (DIAG_INGEST_URL) {
    // Fire-and-forget — diag noise must not block the workflow.
    fetch(DIAG_INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, entries: [entry] }),
    }).catch(() => {});
  }
}

export function diagGet(key: string): DiagEntry[] {
  return buffers.get(key) ?? [];
}

export function diagAppendEntries(key: string, entries: DiagEntry[]): void {
  let arr = buffers.get(key);
  if (!arr) {
    arr = [];
    buffers.set(key, arr);
  }
  for (const e of entries) {
    arr.push(e);
    if (arr.length > MAX_ENTRIES_PER_KEY) arr.shift();
  }
}

export function diagListKeys(): string[] {
  return Array.from(buffers.keys());
}
