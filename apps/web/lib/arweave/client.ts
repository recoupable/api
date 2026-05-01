import Arweave from "arweave";
import type { JWKInterface } from "arweave/node/lib/wallet";

const rawArweaveKey = process.env.ARWEAVE_KEY;

if (!rawArweaveKey) {
  throw new Error(
    "ARWEAVE_KEY environment variable is missing. Please set it to a base64-encoded JSON key.",
  );
}

const ARWEAVE_KEY: JWKInterface = (() => {
  try {
    const decodedKey = Buffer.from(rawArweaveKey, "base64").toString();
    return JSON.parse(decodedKey) as JWKInterface;
  } catch (error) {
    throw new Error(
      `Failed to decode ARWEAVE_KEY. Ensure it is base64-encoded JSON. ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
})();

export const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
  timeout: 20000,
  logging: false,
});

export { ARWEAVE_KEY };
