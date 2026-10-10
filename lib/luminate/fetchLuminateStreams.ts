import { readLuminateBody } from "./readLuminateBody";
import { checkLuminateRecordingResponse } from "./checkLuminateRecordingResponse";
import { FatalError } from "workflow";
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
  if (!(await checkLuminateRecordingResponse(response))) return null;
  try {
    return {
      ...normalizeLuminateStreams(await readLuminateBody(response, 1000000, "Luminate"), request),
      retrieved_at: new Date().toISOString(),
    };
  } catch {
    throw new FatalError("Luminate returned invalid daily recording data");
  }
}
