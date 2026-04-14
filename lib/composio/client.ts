import { getComposioApiKey } from "./getComposioApiKey";

export const getComposioClient = async () => {
  const { Composio } = await import("@composio/core");
  const { VercelProvider } = await import("@composio/vercel");

  const apiKey = getComposioApiKey();

  return new Composio({
    apiKey,
    provider: new VercelProvider(),
  });
};
