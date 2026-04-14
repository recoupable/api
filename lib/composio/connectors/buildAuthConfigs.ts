/**
 * Build Auth Configs.
 *
 * @returns - Computed result.
 */
export function buildAuthConfigs(): Record<string, string> | undefined {
  const configs: Record<string, string> = {};
  if (process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID) {
    configs.tiktok = process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
  }
  if (process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID) {
    configs.instagram = process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;
  }
  return Object.keys(configs).length > 0 ? configs : undefined;
}
