const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  twitter: "X",
  youtube: "YouTube",
  facebook: "Facebook",
  threads: "Threads",
};

/** Customer-facing label for a scraper platform key. */
export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform.toLowerCase()] ?? platform;
}
