import { getChartmetricToken } from "@/lib/chartmetric/getChartmetricToken";

const CHARTMETRIC_BASE = "https://api.chartmetric.com/api";

interface ProxyResult {
  data: unknown;
  status: number;
}

/**
 * Proxies a request to the Chartmetric API with authentication.
 * Returns the parsed JSON response with the `obj` wrapper stripped.
 *
 * @param path - Chartmetric API path (e.g., "/artist/3380/stat/spotify")
 * @param queryParams - Optional query parameters to append
 * @returns The response data (contents of `obj` if present, otherwise full response)
 */
export async function proxyToChartmetric(
  path: string,
  queryParams?: Record<string, string>,
): Promise<ProxyResult> {
  try {
    const accessToken = await getChartmetricToken();

    const url = new URL(`${CHARTMETRIC_BASE}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {
        data: { error: `Chartmetric API returned ${response.status}` },
        status: response.status,
      };
    }

    const json = await response.json();

    const data = json.obj !== undefined ? json.obj : json;

    return { data, status: response.status };
  } catch {
    return { data: null, status: 500 };
  }
}
