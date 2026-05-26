import { tool } from "ai";
import { z } from "zod";
import { getSandbox } from "@/lib/agent/tools/getSandbox";
import { joinSandboxPath, resolveSandboxPath } from "@/lib/sandbox/sandboxPaths";
import { shellEscape } from "@/lib/agent/tools/shellEscape";
import { toDisplayPath } from "@/lib/agent/tools/toDisplayPath";

interface FileInfo {
  path: string;
  size: number;
  modifiedAt: number;
}

const globInputSchema = z.object({
  pattern: z.string().describe("Glob pattern to match (e.g., '**/*.ts')"),
  path: z
    .string()
    .optional()
    .describe("Workspace-relative base directory to search from (e.g., src)"),
  limit: z.number().optional().describe("Maximum number of results. Default: 100"),
});

const GLOB_TIMEOUT_MS = 30_000;
const DEFAULT_LIMIT = 100;

/**
 * `glob` — find files matching a glob pattern, sorted by mtime (newest
 * first). Skips hidden files and `node_modules`. Uses `find -printf` on
 * GNU find (Linux sandboxes), falling back to `xargs stat` on BSD find.
 */
export const globTool = tool({
  description: `Find files matching a glob pattern.

WHEN TO USE:
- Locating files by extension or naming pattern (e.g., all *.test.ts files)
- Discovering where components, migrations, or configs live
- Getting a quick list of recently modified files of a given type

WHEN NOT TO USE:
- Searching inside file contents (use grepTool instead)
- Reading file contents (use readFileTool instead)

USAGE:
- Supports patterns like "**/*.ts", "src/**/*.js", "*.json"
- Returns FILES (not directories) sorted by modification time (newest first)
- Skips hidden files (names starting with ".") and node_modules
- If path is omitted, the current working directory is used as the base
- Use workspace-relative paths when setting path
- Results are limited by the limit parameter (default: 100)

IMPORTANT:
- Patterns are matched primarily on the final path segment (file name), with basic "*" and "**" support
- Use this to narrow down candidate files before calling readFileTool or grepTool`,
  inputSchema: globInputSchema,
  execute: async (
    { pattern, path: basePath, limit = DEFAULT_LIMIT },
    { experimental_context, abortSignal },
  ) => {
    const sandbox = await getSandbox(experimental_context, "glob");
    const workingDirectory = sandbox.workingDirectory;

    try {
      let searchDir: string;
      if (basePath) {
        searchDir = resolveSandboxPath(workingDirectory, basePath);
      } else {
        searchDir = workingDirectory;
      }

      // Extract file-name pattern (last segment) + literal directory prefix
      // (segments before any wildcards) so we can constrain `find -maxdepth`.
      const patternParts = pattern.split("/").filter(Boolean);
      const namePattern = patternParts[patternParts.length - 1] ?? "*";
      const literalPrefix: string[] = [];
      for (let i = 0; i < patternParts.length - 1; i++) {
        const part = patternParts[i]!;
        if (part.includes("*") || part.includes("?") || part.includes("[")) break;
        literalPrefix.push(part);
      }
      if (literalPrefix.length > 0) {
        searchDir = joinSandboxPath(searchDir, ...literalPrefix);
      }

      const remainingDirSegments = patternParts.slice(
        literalPrefix.length,
        patternParts.length - 1,
      );
      const hasRecursiveWildcard =
        remainingDirSegments.some(s => s === "**") || namePattern === "**";

      let maxDepth: number | undefined;
      if (!hasRecursiveWildcard) {
        maxDepth = remainingDirSegments.length + 1;
      }

      const findArgs: string[] = ["find", shellEscape(searchDir)];
      if (maxDepth !== undefined) findArgs.push("-maxdepth", String(maxDepth));
      findArgs.push(
        "-not",
        "-path",
        "'*/.*'",
        "-not",
        "-path",
        "'*/node_modules/*'",
        "-type",
        "f",
        "-name",
        shellEscape(namePattern),
      );

      // GNU `find -printf` (Linux) vs BSD `find` (macOS) compatibility.
      const findBase = findArgs.join(" ");
      const command = [
        `{ ${findBase} -printf '%T@\\t%s\\t%p\\n' 2>/dev/null`,
        `|| ${findBase} -print0 | xargs -0 stat -f '%m%t%z%t%N' ; }`,
        `| sort -t$'\\t' -k1 -rn | head -n ${limit}`,
      ].join(" ");

      const result = await sandbox.exec(command, workingDirectory, GLOB_TIMEOUT_MS, {
        signal: abortSignal,
      });

      // find may exit 1 on permission errors but still produce valid output.
      if (!result.success && result.exitCode !== 1) {
        return {
          success: false,
          error: `Glob failed (exit ${result.exitCode}): ${result.stdout.slice(0, 500)}`,
        };
      }

      const files: FileInfo[] = [];
      const lines = result.stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        const firstTab = line.indexOf("\t");
        if (firstTab === -1) continue;
        const secondTab = line.indexOf("\t", firstTab + 1);
        if (secondTab === -1) continue;
        const mtimeSeconds = parseFloat(line.slice(0, firstTab));
        const size = parseInt(line.slice(firstTab + 1, secondTab), 10);
        const filePath = line.slice(secondTab + 1);
        if (isNaN(mtimeSeconds) || isNaN(size) || !filePath) continue;
        files.push({
          path: toDisplayPath(filePath, workingDirectory),
          size,
          modifiedAt: mtimeSeconds * 1000,
        });
      }

      return {
        success: true,
        pattern,
        baseDir: toDisplayPath(searchDir, workingDirectory),
        count: files.length,
        files: files.map(f => ({
          path: f.path,
          size: f.size,
          modifiedAt: new Date(f.modifiedAt).toISOString(),
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Glob failed: ${message}` };
    }
  },
});
