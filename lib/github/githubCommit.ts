export interface GitHubCommit {
  commit: {
    message: string;
    author: {
      date: string;
    } | null;
    committer: {
      date: string;
    } | null;
  };
}

export const GITHUB_API_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "Recoup-API",
});
