/** In-memory ring buffer for stop-path diagnostic timing. Debug-only. */

const MAX_ENTRIES_PER_KEY = 2000;
const buffers = new Map<string, DiagEntry[]>();
let DIAG_INGEST_URL: string | undefined;

export type DiagEntry = {
  ts: number;
  msg: string;
  data?: Record<string, unknown>;
};

export function setDiagIngestUrl(url: string | undefined): void {
  DIAG_INGEST_URL = url;
}

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
