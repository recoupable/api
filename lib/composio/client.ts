import { getComposioApiKey } from "./getComposioApiKey";

/**
 * Lazily imports and creates a Composio client.
 * Uses dynamic imports to avoid bundler issues with @composio/core's
 * use of createRequire(import.meta.url).
 */
export const getComposioClient = async () => {
  const { Composio } = await import("@composio/core");
  const { VercelProvider } = await import("@composio/vercel");

  const apiKey = getComposioApiKey();

  return new Composio({
    apiKey,
    provider: new VercelProvider(),
  });
};
