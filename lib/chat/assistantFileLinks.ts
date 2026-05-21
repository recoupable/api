const WORKSPACE_FILE_HREF_PREFIX = "#workspace-file=";

function normalizeWorkspaceFilePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").trim();
}

/**
 * Build the in-app deep link the chat UI uses to open a workspace file.
 *
 * @param filePath - Repo-relative file path (e.g. `src/index.ts`).
 * @returns Href fragment prefixed with `#workspace-file=`.
 */
export function buildWorkspaceFileHref(filePath: string): string {
  return `${WORKSPACE_FILE_HREF_PREFIX}${normalizeWorkspaceFilePath(filePath)}`;
}

/**
 * System prompt fragment telling the assistant how to render workspace
 * file paths as clickable links inside chat messages.
 */
export const assistantFileLinkPrompt = [
  "When you mention a workspace file path in assistant text, render it as a markdown link using this exact format:",
  `- \`[path/to/file.ts](${buildWorkspaceFileHref("path/to/file.ts")})\``,
  "- Use the repo-relative file path as both the visible link text and the path inside the link.",
  "- Whole-file links only for now. Do not include line numbers or ranges.",
  "- Do not use this format for URLs or anything that is not a real workspace file path.",
  "- If you are not sure of the exact file path, do not invent one.",
].join("\n");
