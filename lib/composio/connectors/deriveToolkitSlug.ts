/**
 * Derives the Composio toolkit slug from an action slug.
 *
 * Action slugs are `UPPERCASE_SNAKE_CASE` and prefixed with their toolkit
 * (e.g. `LINKEDIN_CREATE_LINKED_IN_POST` → `linkedin`,
 * `TWITTER_CREATION_OF_A_POST` → `twitter`). Composio's file upload is scoped
 * to a `{ toolSlug, toolkitSlug }`, so we recover the toolkit from the leading
 * token of the action slug.
 *
 * @param toolSlug - The action slug (e.g. `LINKEDIN_CREATE_LINKED_IN_POST`)
 * @returns The lowercase toolkit slug (e.g. `linkedin`)
 */
export function deriveToolkitSlug(toolSlug: string): string {
  return toolSlug.split("_")[0].toLowerCase();
}
