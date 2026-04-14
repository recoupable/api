import { getRepoFileTree, type FileTreeEntry } from "@/lib/github/getRepoFileTree";
import { getOrgRepoUrls } from "@/lib/github/getOrgRepoUrls";

/**
 * Get Artist File Tree.
 *
 * @param githubRepo - Value for githubRepo.
 * @param artistSlug - Value for artistSlug.
 * @returns - Computed result.
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
