import { getRepoFileTree, type FileTreeEntry } from "@/lib/github/getRepoFileTree";
import { getOrgRepoUrls } from "@/lib/github/getOrgRepoUrls";

/**
 * Gets the file tree that contains the artist, checking the main repo
 * first, then falling back to org submodule repos.
 *
 * @param githubRepo - The GitHub repository URL to search first.
 * @param artistSlug - The artist's directory slug to locate within the repo.
 * @returns The file tree entries for the repo that contains the artist, or null if not found.
 */
export async function getArtistFileTree(
  githubRepo: string,
  artistSlug: string,
): Promise<FileTreeEntry[] | null> {
  const mainTree = await getRepoFileTree(githubRepo);
  if (mainTree) {
    const blobPaths = mainTree.filter(e => e.type === "blob").map(e => e.path);
    const hasArtist = blobPaths.some(
      p => p.startsWith(`artists/${artistSlug}/`) || p.startsWith(`${artistSlug}/`),
    );
    if (hasArtist) return mainTree;
  }

  const orgUrls = await getOrgRepoUrls(githubRepo);
  for (const orgUrl of orgUrls) {
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
