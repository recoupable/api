import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { getArtistFileTree } from "@/lib/content/getArtistFileTree";
import { getArtistRootPrefix } from "@/lib/content/getArtistRootPrefix";

type MissingSeverity = "required" | "recommended";

export interface ContentReadinessIssue {
  file: string;
  severity: MissingSeverity;
  fix: string;
}

export interface ArtistContentReadiness {
  artist_account_id: string;
  ready: boolean;
  missing: ContentReadinessIssue[];
  warnings: ContentReadinessIssue[];
  /** The GitHub repo URL for this account's sandbox. */
  githubRepo: string;
}

/**
 * Checks whether an artist has the expected files for content creation.
 * Searches the main repo and org submodule repos.
 *
 * @param root0 - Options object.
 * @param root0.accountId - The account ID that owns the sandbox GitHub repo.
 * @param root0.artistAccountId - The artist's account ID, returned in the readiness result.
 * @param root0.artistSlug - The artist's directory slug used to locate files in the repo.
 * @returns Readiness result with missing required files, warnings, and the resolved GitHub repo URL.
 */
export async function getArtistContentReadiness({
  accountId,
  artistAccountId,
  artistSlug,
}: {
  accountId: string;
  artistAccountId: string;
  artistSlug: string;
}): Promise<ArtistContentReadiness> {
  const snapshots = await selectAccountSnapshots(accountId);
  if (!snapshots) {
    throw new Error("Failed to query account snapshots");
  }
  const githubRepo = snapshots[0]?.github_repo ?? null;
  if (!githubRepo) {
    throw new Error("No GitHub repository configured for this account");
  }

  const tree = await getArtistFileTree(githubRepo, artistSlug);
  if (!tree) {
    // Empty repo or artist not found in any repo — return not-ready instead of crashing
    return {
      artist_account_id: artistAccountId,
      ready: false,
      missing: [
        {
          file: "artists/",
          severity: "required" as const,
          fix: "No repository file tree found. The sandbox repo may be empty or the artist directory does not exist yet.",
        },
      ],
      warnings: [],
      githubRepo,
    };
  }

  const blobPaths = tree.filter(entry => entry.type === "blob").map(entry => entry.path);
  const artistRootPrefix = getArtistRootPrefix(blobPaths, artistSlug);

  const hasFile = (relativePath: string): boolean =>
    blobPaths.some(path => path === `${artistRootPrefix}${relativePath}`);
  const hasAnyMp3 = blobPaths.some(
    path => path.startsWith(artistRootPrefix) && path.toLowerCase().endsWith(".mp3"),
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
    artist_account_id: artistAccountId,
    ready: requiredMissing.length === 0,
    missing: requiredMissing,
    warnings,
    githubRepo,
  };
}
