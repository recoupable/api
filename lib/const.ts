import type { Address } from "viem";

if (!process.env.PRIVY_PROJECT_SECRET) {
  throw new Error("PRIVY_PROJECT_SECRET environment variable is required");
}

export const ACCOUNT_ADDRESS = "0x7AfB9872Ea382B7Eb01c67B6884dD99A744eA64f" as Address;
export const SMART_ACCOUNT_ADDRESS = "0xbAf31935ED514e8F7da81D0A730AB5362DEEEEb7" as Address;
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
export const PAYMASTER_URL = `https://api.developer.coinbase.com/rpc/v1/base/${process.env.PAYMASTER_KEY}`;
export const IMAGE_GENERATE_PRICE = "0.15";
export const DEFAULT_MODEL = "openai/gpt-5-mini";
export const LIGHTWEIGHT_MODEL = "openai/gpt-4o-mini";
export const PRIVY_PROJECT_SECRET = process.env.PRIVY_PROJECT_SECRET;
/** Domain for receiving inbound emails (e.g., support@mail.recoupable.com) */
export const INBOUND_EMAIL_DOMAIN = "@mail.recoupable.com";

/** Domain for sending outbound emails (e.g., support@recoupable.com) */
export const OUTBOUND_EMAIL_DOMAIN = "@recoupable.com";

/** Default from address for outbound emails */
export const RECOUP_FROM_EMAIL = `Agent by Recoup <agent${OUTBOUND_EMAIL_DOMAIN}>`;

export const SUPABASE_STORAGE_BUCKET = "user-files";
