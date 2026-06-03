import { SONGSTATS_BASE } from "@/lib/songstats/songstatsBase";
import type { ProxyResult } from "@/lib/research/providers/ProxyResult";

const DEFAULT_SONGSTATS_TIMEOUT_MS = 10_000;
const SLOW_SONGSTATS_TIMEOUT_MS = 35_000;
const SLOW_SONGSTATS_PATHS = new Set([
  "artists/historic_stats",
  "artists/stats",
  "tracks/historic_stats",
  "tracks/stats",
]);

function appendQueryParams(url: URL, queryParams?: Record<string, string>): void {
  if (!queryParams) return;

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }
}

async function parseSongstatsResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();

  const text = await response.text();
  return text ? { raw: text } : null;
}

function getDefaultSongstatsTimeoutMs(path: string): number {
  return SLOW_SONGSTATS_PATHS.has(path.replace(/^\/+/, ""))
    ? SLOW_SONGSTATS_TIMEOUT_MS
    : DEFAULT_SONGSTATS_TIMEOUT_MS;
}

function getSongstatsTimeoutMs(path: string): number {
  const configured = Number.parseInt(process.env.SONGSTATS_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : getDefaultSongstatsTimeoutMs(path);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getSongstatsApiKey(): string | undefined {
  return process.env.SONGSTATS_API_KEY || process.env.SongStats_API;
}

export async function fetchSongstats(
  path: string,
  queryParams?: Record<string, string>,
): Promise<ProxyResult> {
  const apiKey = getSongstatsApiKey();
  if (!apiKey) {
    return {
      data: { error: "SONGSTATS_API_KEY or SongStats_API environment variable is not set" },
      status: 500,
    };
  }

  try {
    const url = new URL(`${SONGSTATS_BASE}/enterprise/v1/${path.replace(/^\/+/, "")}`);
    appendQueryParams(url, queryParams);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getSongstatsTimeoutMs(path));

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          apikey: apiKey,
        },
      });

      const data = await parseSongstatsResponse(response);
      return { data, status: response.status };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("[ERROR] fetchSongstats:", error);
    if (isAbortError(error)) {
      return { data: { error: "SongStats request timed out" }, status: 504 };
    }

    return { data: { error: "SongStats request failed" }, status: 500 };
  }
}
