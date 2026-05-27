import { tool } from "ai";
import { z } from "zod";
import { getSandbox } from "@/lib/agent/tools/getSandbox";
import { toDisplayPath } from "@/lib/agent/tools/toDisplayPath";
import { resolveSandboxPath } from "@/lib/sandbox/resolveSandboxPath";

const editInputSchema = z.object({
  filePath: z.string().describe("Workspace-relative path to the file to edit (e.g., src/auth.ts)"),
  oldString: z.string().describe("The exact text to replace"),
  newString: z.string().describe("The text to replace it with (must differ from oldString)"),
  replaceAll: z.boolean().optional().describe("Replace all occurrences. Default: false"),
  startLine: z
    .number()
    .optional()
    .describe("Line number where oldString starts (for diff display)"),
});

/**
 * `edit` — exact-string replacement inside a sandboxed file. Requires the
 * model to have already read the file so it can produce a unique
 * `oldString`. Rejects ambiguous matches unless `replaceAll` is set.
 */
export const editFileTool = tool({
  description: `Perform exact string replacement in a file.

WHEN TO USE:
- Making small, precise edits to an existing file you have already read
- Renaming a variable or identifier consistently within a single file
- Changing a specific block of code or configuration exactly as seen in the read output

WHEN NOT TO USE:
- Creating new files (use writeFileTool instead)
- Large structural rewrites where it's simpler to rewrite the entire file (use writeFileTool)

USAGE:
- Use workspace-relative file paths (e.g., "src/auth.ts")
- You must read the file first with readFileTool in this conversation
- Provide oldString as the EXACT text to replace, including whitespace and indentation
- By default, oldString must be UNIQUE in the file; otherwise the edit will fail
- Use replaceAll: true to change ALL occurrences (e.g., for a rename)
- ALWAYS provide startLine when known: the line number where oldString begins

IMPORTANT:
- Preserve exact indentation and spacing from the file's content as returned by readFileTool
- Never include line numbers or the "N: " line prefixes from the read output in oldString or newString
- If oldString appears multiple times and replaceAll is false, the tool FAILS with an error and occurrence count`,
  inputSchema: editInputSchema,
  execute: async (
    { filePath, oldString, newString, replaceAll = false },
    { experimental_context },
  ) => {
    const sandbox = await getSandbox(experimental_context, "edit");
    const workingDirectory = sandbox.workingDirectory;

    try {
      if (oldString === newString) {
        return { success: false, error: "oldString and newString must be different" };
      }

      const absolutePath = resolveSandboxPath(workingDirectory, filePath);
      const content = await sandbox.readFile(absolutePath, "utf-8");

      if (!content.includes(oldString)) {
        return {
          success: false,
          error: "oldString not found in file",
          hint: "Make sure to match exact whitespace and indentation",
        };
      }

      const occurrences = content.split(oldString).length - 1;
      if (occurrences > 1 && !replaceAll) {
        return {
          success: false,
          error: `oldString found ${occurrences} times. Use replaceAll=true or provide more context to make it unique.`,
        };
      }

      const matchIndex = content.indexOf(oldString);
      const startLine = content.slice(0, matchIndex).split("\n").length;
      const newContent = replaceAll
        ? content.replaceAll(oldString, newString)
        : content.replace(oldString, newString);

      await sandbox.writeFile(absolutePath, newContent, "utf-8");

      return {
        success: true,
        path: toDisplayPath(absolutePath, workingDirectory),
        replacements: replaceAll ? occurrences : 1,
        startLine,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to edit file: ${message}` };
    }
  },
});
