import { SONGSTATS_BASE } from "@/lib/songstats/songstatsBase";
import type { ProxyResult } from "@/lib/research/ProxyResult";
import { appendQueryParams } from "@/lib/songstats/appendQueryParams";
import { parseSongstatsResponse } from "@/lib/songstats/parseSongstatsResponse";
import { getSongstatsTimeoutMs } from "@/lib/songstats/getSongstatsTimeoutMs";
import { isAbortError } from "@/lib/songstats/isAbortError";
import { getSongstatsApiKey } from "@/lib/songstats/getSongstatsApiKey";

export async function fetchSongstats(
  path: string,
  queryParams?: Record<string, string>,
): Promise<ProxyResult> {
  const apiKey = getSongstatsApiKey();
  if (!apiKey) {
    console.error("[ERROR] fetchSongstats: SONGSTATS_API_KEY environment variable is not set");
    return {
      data: { error: "Internal server error" },
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
