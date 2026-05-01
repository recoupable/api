/**
 * Posts a comment on a GitHub issue/PR.
 *
 * @param repo - Full repo name (owner/repo)
 * @param prNumber - The PR/issue number
 * @param body - The comment body (markdown)
 */
export async function postGitHubComment(
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;

  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to post GitHub comment on ${repo}#${prNumber}:`, text);
  }
}
