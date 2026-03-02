import type { Sandbox } from "@vercel/sandbox";
import type { SetupDeps } from "./types";

/**
 * Writes a README.md to the sandbox root with details about the sandbox environment.
 * Idempotent -- skips if the README already contains sandbox details.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param sandboxId - The sandbox identifier
 * @param accountId - The account ID that owns the sandbox
 * @param githubRepo - The GitHub repo URL associated with the sandbox, if any
 * @param deps - Logging dependencies
 */
export async function writeReadme(
  sandbox: Sandbox,
  sandboxId: string,
  accountId: string,
  githubRepo: string | undefined,
  deps: SetupDeps,
): Promise<void> {
  const check = await sandbox.runCommand({
    cmd: "grep",
    args: ["-q", "Recoup Sandbox", "README.md"],
  });

  if (check.exitCode === 0) {
    deps.log("README.md already has sandbox details, skipping");
    return;
  }

  const repoLine = githubRepo
    ? `- **GitHub Repo**: ${githubRepo}`
    : "- **GitHub Repo**: Not configured";

  const content = `# Recoup Sandbox

This is an isolated Linux microVM sandbox environment managed by [Recoup](https://recoupable.com).

## Sandbox Details

- **Sandbox ID**: \`${sandboxId}\`
- **Account ID**: \`${accountId}\`
${repoLine}

## What is a Sandbox?

Sandboxes are ephemeral, isolated Linux microVM environments created via the [Recoup API](https://developers.recoupable.com/api-reference/sandboxes/create). They provide a safe space to execute code, run AI agent tasks, and evaluate generated output.

### Key Features

- **Isolated execution** -- each sandbox runs in its own microVM
- **Snapshot support** -- sandbox state can be saved and restored from snapshots
- **GitHub integration** -- sandboxes can be linked to a GitHub repo for persistent file storage
- **Command execution** -- run any command with optional arguments and working directory
- **Automatic timeout** -- sandboxes stop automatically after a configurable timeout period

### API

Create a sandbox via \`POST /api/sandboxes\`:

\`\`\`json
{
  "command": "ls",
  "args": ["-la", "/home"],
  "cwd": "/home/user"
}
\`\`\`

The response includes sandbox status, snapshot ID, and GitHub repo if configured:

\`\`\`json
{
  "status": "success",
  "sandboxes": [
    {
      "sandboxId": "sbx_abc123",
      "sandboxStatus": "running",
      "timeout": 300000,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "snapshot_id": "snap_abc123",
  "github_repo": "https://github.com/org/repo"
}
\`\`\`

### Docs

Full API documentation: https://developers.recoupable.com
`;

  deps.log("Writing README.md to sandbox");

  await sandbox.writeFiles([
    {
      path: "/vercel/sandbox/README.md",
      content: Buffer.from(content),
    },
  ]);

  deps.log("README.md written successfully");
}
