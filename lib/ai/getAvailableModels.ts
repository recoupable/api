import { GatewayLanguageModelEntry } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";

const GATEWAY_CONFIG_URL = "https://ai-gateway.vercel.sh/v1/ai/config";

/**
 * Fetches the Vercel AI Gateway model catalog directly. The
 * `@ai-sdk/gateway` SDK's `getAvailableModels()` currently rejects valid
 * success responses with a Zod "expected error.object" validation error,
 * so we hit the underlying endpoint ourselves.
 */
export const getAvailableModels = async () => {
  try {
    const headers: Record<string, string> = {
      "ai-gateway-protocol-version": "0.0.1",
    };
    const token = process.env.VERCEL_OIDC_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(GATEWAY_CONFIG_URL, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { models: GatewayLanguageModelEntry[] };
    return data.models.filter(m => !isEmbedModel(m));
  } catch (error) {
    console.error("[getAvailableModels] Gateway fetch failed:", error);
    return [];
  }
};
