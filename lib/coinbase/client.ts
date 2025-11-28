import { CdpClient } from "@coinbase/cdp-sdk";

const apiKeyName = process.env.CDP_API_KEY_ID;
const privateKey = process.env.CDP_API_KEY_SECRET;
const walletSecret = process.env.CDP_WALLET_SECRET;

if (!apiKeyName || !privateKey || !walletSecret) {
  throw new Error("CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET must be set");
}

/**
 * Initializes the Coinbase SDK with credentials from environment variables
 */
export const cdp = new CdpClient();
