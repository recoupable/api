import { getRepoFileTree, type FileTreeEntry } from "@/lib/github/getRepoFileTree";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";

type MissingSeverity = "required" | "recommended";

export interface ContentReadinessIssue {
  file: string;
  severity: MissingSeverity;
  fix: string;
}

export interface ArtistContentReadiness {
  artist_slug: string;
  ready: boolean;
  missing: ContentReadinessIssue[];
  warnings: ContentReadinessIssue[];
  /** The GitHub repo URL for this account's sandbox. */
  githubRepo: string;
}

function getArtistRootPrefix(paths: string[], artistSlug: string): string {
  const preferredPrefix = `artists/${artistSlug}/`;
  if (paths.some(path => path.startsWith(preferredPrefix))) {
    return preferredPrefix;
  }

  const directPrefix = `${artistSlug}/`;
  if (paths.some(path => path.startsWith(directPrefix))) {
    return directPrefix;
  }

  return preferredPrefix;
}

/**
 * Gets the file tree that contains the artist, checking the main repo
 * first, then falling back to org submodule repos.
 */
async function getArtistFileTree(
  githubRepo: string,
  artistSlug: string,
): Promise<FileTreeEntry[] | null> {
  // Try main repo first
  const mainTree = await getRepoFileTree(githubRepo);
  if (mainTree) {
    const blobPaths = mainTree.filter(e => e.type === "blob").map(e => e.path);
    const hasArtist = blobPaths.some(
      p => p.startsWith(`artists/${artistSlug}/`) || p.startsWith(`${artistSlug}/`),
    );
    if (hasArtist) return mainTree;
  }

  // Not in main repo — check org submodule repos
  const orgRepoUrls = await getOrgRepoUrls(githubRepo);
  for (const orgUrl of orgRepoUrls) {
    const orgTree = await getRepoFileTree(orgUrl);
    if (orgTree) {
      const blobPaths = orgTree.filter(e => e.type === "blob").map(e => e.path);
      const hasArtist = blobPaths.some(
        p => p.startsWith(`artists/${artistSlug}/`) || p.startsWith(`${artistSlug}/`),
      );
      if (hasArtist) return orgTree;
    }
  }

  return mainTree;
}

/**
 * Reads .gitmodules from the repo and extracts org submodule URLs.
 */
async function getOrgRepoUrls(githubRepo: string): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];

  const match = githubRepo.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return [];
  const [, owner, repo] = match;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/.gitmodules`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3.raw",
          "User-Agent": "Recoup-API",
        },
      },
    );
    if (!response.ok) return [];

    const content = await response.text();
    const urls: string[] = [];
    const urlMatches = content.matchAll(/url\s*=\s*(https:\/\/github\.com\/[^\s]+)/g);
    for (const m of urlMatches) {
      urls.push(m[1]);
    }
    return urls;
  } catch {
    return [];
  }
}

/**
 * Checks whether an artist has the expected files for content creation.
 * Searches the main repo and org submodule repos.
 */
export async function getArtistContentReadiness({
  accountId,
  artistSlug,
}: {
  accountId: string;
  artistSlug: string;
}): Promise<ArtistContentReadiness> {
  const snapshots = await selectAccountSnapshots(accountId);
  const githubRepo = snapshots[0]?.github_repo ?? null;
  if (!githubRepo) {
    throw new Error("No GitHub repository found for this account");
  }

  const tree = await getArtistFileTree(githubRepo, artistSlug);
  if (!tree) {
    throw new Error("Failed to retrieve repository file tree");
  }

  const blobPaths = tree.filter(entry => entry.type === "blob").map(entry => entry.path);
  const artistRootPrefix = getArtistRootPrefix(blobPaths, artistSlug);

  const hasFile = (relativePath: string): boolean =>
    blobPaths.some(path => path === `${artistRootPrefix}${relativePath}`);
  const hasAnyMp3 = blobPaths.some(
    path =>
      path.startsWith(artistRootPrefix) &&
      path.toLowerCase().endsWith(".mp3"),
  );

  const issues: ContentReadinessIssue[] = [];

  if (!hasFile("context/images/face-guide.png")) {
    issues.push({
      file: "context/images/face-guide.png",
      severity: "required",
      fix: "Generate a face guide image before creating content.",
    });
  }

  // config/content-creation/config.json is optional — the pipeline uses sensible
  // defaults and only reads the artist config file to override specific fields.
  if (!hasFile("config/content-creation/config.json")) {
    issues.push({
      file: "config/content-creation/config.json",
      severity: "recommended",
      fix: "Add a pipeline config to override default model/resolution settings.",
    });
  }

  if (!hasAnyMp3) {
    issues.push({
      file: "songs/*.mp3",
      severity: "required",
      fix: "Add at least one .mp3 file for audio selection.",
    });
  }

  if (!hasFile("context/artist.md")) {
    issues.push({
      file: "context/artist.md",
      severity: "recommended",
      fix: "Add artist context to improve caption quality.",
    });
  }

  if (!hasFile("context/audience.md")) {
    issues.push({
      file: "context/audience.md",
      severity: "recommended",
      fix: "Add audience context to improve targeting.",
    });
  }

  if (!hasFile("context/era.json")) {
    issues.push({
      file: "context/era.json",
      severity: "recommended",
      fix: "Add era metadata to improve song selection relevance.",
    });
  }

  const requiredMissing = issues.filter(item => item.severity === "required");
  const warnings = issues.filter(item => item.severity === "recommended");

  return {
    artist_slug: artistSlug,
    ready: requiredMissing.length === 0,
    missing: requiredMissing,
    warnings,
    githubRepo,
  };
}
