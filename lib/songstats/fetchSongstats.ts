import { SONGSTATS_BASE } from "@/lib/songstats/songstatsBase";

interface ProxyResult {
  data: unknown;
  status: number;
}

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

export async function fetchSongstats(
  path: string,
  queryParams?: Record<string, string>,
): Promise<ProxyResult> {
  const apiKey = process.env.SongStats_API;
  if (!apiKey) {
    return {
      data: { error: "SongStats_API environment variable is not set" },
      status: 500,
    };
  }

  try {
    const url = new URL(`${SONGSTATS_BASE}/enterprise/v1/${path.replace(/^\/+/, "")}`);
    appendQueryParams(url, queryParams);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        apikey: apiKey,
      },
    });

    const data = await parseSongstatsResponse(response);
    return { data, status: response.status };
  } catch {
    return { data: null, status: 500 };
  }
}
