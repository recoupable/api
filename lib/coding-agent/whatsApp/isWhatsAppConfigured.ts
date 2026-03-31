export const WHATSAPP_ENV_VARS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
] as const;

/**
 * Returns true when all WhatsApp environment variables are configured.
 *
 * @returns True if all required WhatsApp env vars are set and non-empty, false otherwise
 */
export function isWhatsAppConfigured(): boolean {
  return WHATSAPP_ENV_VARS.every(name => !!process.env[name]);
}
