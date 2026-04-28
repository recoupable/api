import { ApifyClient } from "apify-client";

let cachedClient: ApifyClient | null = null;

function getApifyClient(): ApifyClient {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("Missing APIFY_TOKEN environment variable");
  }
  cachedClient ??= new ApifyClient({ token });
  return cachedClient;
}

/** Lazy Apify client so `next build` can load routes without APIFY_TOKEN at import time. */
const apifyClient = new Proxy({} as ApifyClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getApifyClient(), prop, receiver);
  },
});

export { apifyClient };
export default apifyClient;
