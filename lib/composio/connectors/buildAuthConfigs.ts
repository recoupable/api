/**
 * Build auth configs from environment variables.
 * Must match the configs used during authorization so Composio
 * can find connections created with custom OAuth credentials.
 */
export function buildAuthConfigs(): Record<string, string> | undefined {
  const configs: Record<string, string> = {};
  if (process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID) {
    configs.tiktok = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
  }
  if (process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID) {
    configs.instagram = process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;
  }
  if (process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID) {
    configs.googlesheets = process.env.COMPOSIO_GOOGLE_SHEETS_AUTH_CONFIG_ID;
  }
  if (process.env.COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID) {
    configs.googledocs = process.env.COMPOSIO_GOOGLE_DOCS_AUTH_CONFIG_ID;
  }
  if (process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID) {
    configs.googledrive = process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID;
  }
  return Object.keys(configs).length > 0 ? configs : undefined;
}
