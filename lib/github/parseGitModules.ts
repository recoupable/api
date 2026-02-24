export interface SubmoduleEntry {
  path: string;
  url: string;
}

/**
 * Parses .gitmodules content into an array of submodule entries.
 *
 * @param content - The raw text content of a .gitmodules file
 * @returns Array of submodule entries with path and url
 */
export function parseGitModules(content: string): SubmoduleEntry[] {
  const entries: SubmoduleEntry[] = [];
  let currentPath: string | null = null;
  let currentUrl: string | null = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[submodule")) {
      if (currentPath && currentUrl) {
        entries.push({ path: currentPath, url: currentUrl });
      }
      currentPath = null;
      currentUrl = null;
    } else if (trimmed.startsWith("path")) {
      const match = trimmed.match(/^path\s*=\s*(.+)$/);
      if (match) currentPath = match[1].trim();
    } else if (trimmed.startsWith("url")) {
      const match = trimmed.match(/^url\s*=\s*(.+)$/);
      if (match) currentUrl = match[1].trim();
    }
  }

  if (currentPath && currentUrl) {
    entries.push({ path: currentPath, url: currentUrl });
  }

  return entries;
}
