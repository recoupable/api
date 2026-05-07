/**
 * Returns the service-account GitHub token used for cloning private
 * repositories into sandboxes. Returns undefined when the env var is
 * unset or empty so callers can fall back to public-repo behavior
 * without crashing.
 *
 * @returns The token string, or undefined.
 */
export function getServiceGithubToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN;
  return token && token.length > 0 ? token : undefined;
}
