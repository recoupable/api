import { tool } from "ai";
import { z } from "zod";
import { getSandbox } from "@/lib/agent/tools/getSandbox";
import { resolveSandboxPath } from "@/lib/sandbox/sandboxPaths";
import { shellEscape } from "@/lib/agent/tools/shellEscape";
import { toDisplayPath } from "@/lib/agent/tools/toDisplayPath";

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

const grepInputSchema = z.object({
  pattern: z.string().describe("Regex pattern to search for"),
  path: z.string().describe("Workspace-relative file or directory to search in (e.g., src)"),
  glob: z.string().optional().describe("Glob pattern to filter files (e.g., '*.ts')"),
  caseSensitive: z.boolean().optional().describe("Case-sensitive search. Default: true"),
});

const GREP_TIMEOUT_MS = 30_000;
const MAX_TOTAL_MATCHES = 100;
const MAX_PER_FILE_MATCHES = 10;
const MAX_LINE_LENGTH = 200;

/**
 * `grep` — search for POSIX-ERE patterns across files in the sandbox via
 * `grep -rn`. Caps results to 100 total / 10 per file / 200 chars per
 * match line so long stdouts don't blow the model context.
 */
export const grepTool = tool({
  description: `Search for patterns in files using POSIX Extended Regular Expressions (ERE).

WHEN TO USE:
- Finding where a function, variable, or string literal is used
- Locating configuration keys, routes, or error messages across files
- Narrowing down which files to read or edit

WHEN NOT TO USE:
- Simple filename-only searches (use globTool instead)
- Directory listings, builds, or other shell tasks (use bashTool instead)

USAGE:
- Uses POSIX ERE syntax (e.g., "log.*Error", "function[[:space:]]+[a-zA-Z_]+")
- Perl-style shorthands like \\s, \\w, \\d are NOT supported; use POSIX classes instead: [[:space:]], [[:alnum:]_], [[:digit:]]
- Search a specific file OR an entire directory via the path parameter
- Use workspace-relative paths for path (e.g., "src")
- Optionally filter files with glob (e.g., "*.ts", "*.test.js")
- Matches are SINGLE-LINE: patterns do not span across newline characters
- Results are limited to 100 matches total, with up to 10 matches per file; each match line is truncated to 200 characters

IMPORTANT:
- ALWAYS use this tool for code/content searches instead of running grep/rg via bashTool
- Use caseSensitive: false for case-insensitive searches
- Hidden files and node_modules are skipped when searching directories`,
  inputSchema: grepInputSchema,
  execute: async (
    { pattern, path: searchPath, glob, caseSensitive = true },
    { experimental_context, abortSignal },
  ) => {
    const sandbox = await getSandbox(experimental_context, "grep");
    const workingDirectory = sandbox.workingDirectory;

    try {
      const absolutePath = resolveSandboxPath(workingDirectory, searchPath);

      const args: string[] = ["grep", "-rn"];
      if (!caseSensitive) args.push("-i");
      args.push(
        `--exclude-dir=${shellEscape(".*")}`,
        `--exclude-dir=${shellEscape("node_modules")}`,
      );
      if (glob) args.push(`--include=${shellEscape(glob)}`);
      args.push(
        "-m",
        String(MAX_PER_FILE_MATCHES),
        "-E",
        shellEscape(pattern),
        shellEscape(absolutePath),
      );
      const command = args.join(" ");

      const result = await sandbox.exec(command, workingDirectory, GREP_TIMEOUT_MS, {
        signal: abortSignal,
      });

      // grep exits with 1 when no matches found — that's not an error.
      if (!result.success && result.exitCode !== 1) {
        const errorOutput = (result.stderr || result.stdout).slice(0, 500);
        return {
          success: false,
          error: `Grep failed (exit ${result.exitCode}): ${errorOutput}`,
        };
      }

      const matches: GrepMatch[] = [];
      const filesSet = new Set<string>();
      const fileMatchCounts = new Map<string, number>();

      const lines = result.stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        if (matches.length >= MAX_TOTAL_MATCHES) break;

        // grep -rn output: file:line:content. Find the `:digits:` separator.
        const match = line.match(/:(\d+):/);
        if (!match || match.index === undefined) continue;
        const file = line.slice(0, match.index);
        const rest = line.slice(match.index + 1);
        const colonIndex = rest.indexOf(":");
        if (colonIndex === -1) continue;

        const lineNum = parseInt(rest.slice(0, colonIndex), 10);
        const content = rest.slice(colonIndex + 1);
        if (isNaN(lineNum)) continue;

        const displayFile = toDisplayPath(file, workingDirectory);
        filesSet.add(displayFile);
        const currentFileCount = fileMatchCounts.get(displayFile) ?? 0;
        if (currentFileCount >= MAX_PER_FILE_MATCHES) continue;

        fileMatchCounts.set(displayFile, currentFileCount + 1);
        matches.push({
          file: displayFile,
          line: lineNum,
          content: content.slice(0, MAX_LINE_LENGTH),
        });
      }

      return {
        success: true,
        pattern,
        matchCount: matches.length,
        filesWithMatches: filesSet.size,
        matches,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Grep failed: ${message}` };
    }
  },
});
