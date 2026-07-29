import { tool } from "ai";
import { z } from "zod";
import * as path from "path";
import { getSandbox } from "@/lib/agent/tools/getSandbox";
import { toDisplayPath } from "@/lib/agent/tools/toDisplayPath";

const writeInputSchema = z.object({
  filePath: z
    .string()
    .describe("Workspace-relative path to the file to write (e.g., src/user.test.ts)"),
  content: z.string().describe("Content to write to the file"),
});

/**
 * `write` — create or completely overwrite a file in the sandbox. Parent
 * directories are created as needed. For small targeted edits prefer
 * `editFileTool`.
 */
export const writeFileTool = tool({
  description: `Write content to a file on the filesystem.

WHEN TO USE:
- Creating a new file that does not yet exist
- Completely replacing the contents of an existing file after you've read it

WHEN NOT TO USE:
- Small or localized changes to an existing file (prefer editFileTool)
- Reading files (use readFileTool instead)
- Searching (use grepTool or globTool instead)

USAGE:
- Use workspace-relative paths (e.g., "src/user.test.ts")
- This will OVERWRITE existing files entirely
- Parent directories are created automatically if they do not exist

IMPORTANT:
- ALWAYS read an existing file with readFileTool before overwriting it
- Prefer editing existing files over creating new ones unless a new file is explicitly needed
- NEVER proactively create documentation files (e.g., *.md) unless the user explicitly requests them
- Do not write files that contain secrets or credentials (API keys, passwords, .env, etc.)`,
  inputSchema: writeInputSchema,
  execute: async ({ filePath, content }, { context: experimental_context }) => {
    const sandbox = await getSandbox(experimental_context, "write");
    const workingDirectory = sandbox.workingDirectory;

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(workingDirectory, filePath);
      const dir = path.dirname(absolutePath);
      await sandbox.mkdir(dir, { recursive: true });
      await sandbox.writeFile(absolutePath, content, "utf-8");
      const stats = await sandbox.stat(absolutePath);

      return {
        success: true,
        path: toDisplayPath(absolutePath, workingDirectory),
        bytesWritten: stats.size,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to write file: ${message}` };
    }
  },
});
