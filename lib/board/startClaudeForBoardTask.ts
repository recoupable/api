import { Sandbox } from "vercel-sandbox-3";
import type { WatcherContext } from "@vercel/board";
import type { ClaudeBoardTask } from "@/lib/board/getClaudeTaskToStart";
import { AI_GATEWAY_HOST } from "@/lib/board/aiGatewayHost";
import { buildClaudeSandboxNetworkPolicy } from "@/lib/board/buildClaudeSandboxNetworkPolicy";
import { buildClaudeTaskPrompt } from "@/lib/board/buildClaudeTaskPrompt";
import { buildClaudeSandboxScript } from "@/lib/board/buildClaudeSandboxScript";
import { CLAUDE_BOARD_LABEL } from "@/lib/board/claudeBoardLabel";

const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Starts Claude Code in a Vercel Sandbox to work one board task. The sandbox
 * reaches the board as `claude via api`, narrowed to the task's channel, and
 * neither the board credential nor the AI Gateway credential enters it.
 * The agent runs detached, so the watcher's request returns quickly.
 *
 * @param params.board - The board handle the watcher was given.
 * @param params.task - The task to work.
 */
export async function startClaudeForBoardTask({
  board,
  task,
}: {
  board: WatcherContext["board"];
  task: ClaudeBoardTask;
}): Promise<void> {
  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!gatewayToken) {
    throw new Error("No AI Gateway credential: set AI_GATEWAY_API_KEY or enable OIDC");
  }

  const { allow, env } = await board
    .as({ name: CLAUDE_BOARD_LABEL.value })
    .sandboxPolicy({ can: { [task.channel]: ["read", "post", "react", "label"] } });

  const sandbox = await Sandbox.create({
    runtime: "node22",
    timeout: SANDBOX_TIMEOUT_MS,
    networkPolicy: buildClaudeSandboxNetworkPolicy({ boardAllow: allow, gatewayToken }),
    env: {
      ...env,
      ANTHROPIC_BASE_URL: `https://${AI_GATEWAY_HOST}`,
      ANTHROPIC_AUTH_TOKEN: "brokered-by-sandbox-proxy",
      ANTHROPIC_API_KEY: "",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
  });

  await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", buildClaudeSandboxScript()],
    env: { TASK_ID: task.id, CLAUDE_PROMPT: buildClaudeTaskPrompt(task) },
    detached: true,
  });
}
