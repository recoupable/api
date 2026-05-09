export function buildAuthenticatedGitHubUrl(repoUrl: string, token: string): string | null {
  const githubUrlMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);

  if (!githubUrlMatch) {
    return null;
  }

  const [, owner, repo] = githubUrlMatch;
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
}
