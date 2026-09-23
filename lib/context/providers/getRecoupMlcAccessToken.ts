import { createMlcAccessTokenProvider } from "./createMlcAccessTokenProvider";

let provider: (() => Promise<string>) | undefined;

/** Server-only Recoup credential source. Never send these values to a trace or browser. */
export async function getRecoupMlcAccessToken(): Promise<string> {
  const username = process.env.MLC_USERNAME;
  const password = process.env.MLC_PASSWORD;
  if (!username || !password) throw new Error("Recoup MLC credentials are not configured");
  provider ??= createMlcAccessTokenProvider({ username, password });
  return provider();
}
