import { FatalError, RetryableError } from "workflow";
import { getLuminateAccessToken } from "./getLuminateAccessToken";
import {
  luminateStreamRequestSchema,
  normalizeLuminateStreams,
  type LuminateStreamRequest,
} from "./normalizeLuminateStreams";

/** Fetch one bounded daily worldwide recording series. Credentials never enter return values or errors. */
export async function fetchLuminateStreams(input: LuminateStreamRequest) {
  const request = luminateStreamRequestSchema.parse(input);
  const {
    LUMINATE_API_KEY: apiKey,
    LUMINATE_USERNAME: username,
    LUMINATE_PASSWORD: password,
  } = process.env;
  if (!apiKey || !username || !password) throw new FatalError("Luminate is not configured");
  const credentials = { apiKey, username, password };
  let token = await getLuminateAccessToken(credentials);
  const query = new URLSearchParams({
    id_type: "isrc",
    location: "AA",
    start_date: request.since,
    end_date: request.until,
    metrics: "streams",
    aggregate_interval: "day",
    metadata_level: "min",
  });
  const send = () =>
    fetch(`https://api.luminatedata.com/musical_recordings/${request.isrc}?${query}`, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        "x-api-key": apiKey,
        authorization: token,
        accept: "application/vnd.luminate-data.svc-apibff.v1+json",
      },
    });
  let response = await send();
  if (response.status === 401) {
    await response.body?.cancel();
    token = await getLuminateAccessToken(credentials, true);
    response = await send();
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 404) return null;
    if (response.status === 429 || response.status >= 500) {
      const seconds = Number(response.headers.get("retry-after"));
      throw new RetryableError("Luminate temporarily unavailable", {
        retryAfter: `${Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 300) : 60}s`,
      });
    }
    throw new FatalError(`Luminate recording unavailable (HTTP ${response.status})`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new FatalError("Empty Luminate response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 1000000) {
      await reader.cancel();
      throw new FatalError("Luminate response exceeds size limit");
    }
    chunks.push(chunk.value);
  }
  try {
    return {
      ...normalizeLuminateStreams(JSON.parse(Buffer.concat(chunks).toString("utf8")), request),
      retrieved_at: new Date().toISOString(),
    };
  } catch {
    throw new FatalError("Luminate returned invalid daily recording data");
  }
}
