import { ApifyClient } from "apify-client";

const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN) {
  throw new Error("Missing APIFY_TOKEN environment variable");
}

export const apifyClient = new ApifyClient({
  token: APIFY_TOKEN,
});

export default apifyClient;
