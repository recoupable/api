import { z } from "zod";
import type { Tool } from "ai";
import { promptSandboxStreaming } from "@/lib/sandbox/promptSandboxStreaming";

export const SANDBOX_PROMPT_NOTE =
  "IMPORTANT: When you make changes to any files inside the orgs/ directory, " +
  "always commit and push those changes directly to main so they are preserved and shared across sessions.\n\n" +
  "IMPORTANT: When a prompt includes attached file URLs (e.g. from email attachments), " +
  "always download the files first using curl and save them locally before referencing them. " +
  "These URLs are temporary and expire after 1 hour. Never store the download URL directly in files — " +
  "download the content, save it to the appropriate location in the repo, and reference the local path instead.";

const promptSandboxSchema = z.object({
  prompt: z.string().min(1).describe("The prompt to send to OpenClaw running in the sandbox."),
});

interface SandboxStreamProgress {
  status: "booting" | "streaming" | "complete";
  output: string;
  stderr?: string;
  exitCode?: number;
  fromSnapshot?: boolean;
  runId?: string;
}

interface PromptSandboxFinalResult {
  sandboxId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  created: boolean;
  fromSnapshot: boolean;
  runId?: string;
}

/**
 * Creates a local AI SDK generator tool that streams sandbox output to the UI.
 * Overrides the MCP prompt_sandbox tool with real-time streaming support.
 *
 * @param accountId - The account ID for sandbox lookup
 * @param apiKey - The API key passed as RECOUP_API_KEY to the sandbox
 * @returns An AI SDK tool with generator-based execute function
 */
export function createPromptSandboxStreamingTool(
  accountId: string,
  apiKey: string,
): Tool<z.infer<typeof promptSandboxSchema>, SandboxStreamProgress> {
  return {
    description:
      "Send a prompt to the agent running in the artist's persistent sandbox environment. " +
      "This is your primary tool — use it for release management (creating, updating, or reviewing releases), " +
      "file operations, data analysis, content generation, and any multi-step task. " +
      "The sandbox has skills for managing RELEASE.md documents, generating deliverables, and more. " +
      "Reuses the account's existing running sandbox or creates one from the latest snapshot. " +
      "Streams output in real-time. " +
      "IMPORTANT: When the result contains a `runId`, it means the sandbox is being set up for the first time " +
      "and the command was dispatched to a background task. The output will be empty because the task is still running. " +
      "The UI automatically shows a live progress view for background tasks — do NOT summarize or interpret the empty output. " +
      "Simply tell the user their request is being processed in the sandbox and the results will appear in the task progress view above. " +
      "Do NOT automatically poll or check the task status — instead, let the user know they can ask you to check on it whenever they want.",
    inputSchema: promptSandboxSchema,
    execute: async function* ({ prompt }, { abortSignal }) {
      yield { status: "booting" as const, output: "" };

      const augmentedPrompt = SANDBOX_PROMPT_NOTE + "\n\n" + prompt;

      const gen = promptSandboxStreaming({
        accountId,
        apiKey,
        prompt: augmentedPrompt,
        abortSignal,
      });

      let stdout = "";
      let finalResult: PromptSandboxFinalResult | undefined;

      while (true) {
        const iterResult = await gen.next();

        if (iterResult.done) {
          finalResult = iterResult.value as PromptSandboxFinalResult;
          break;
        }

        const chunk = iterResult.value as {
          data: string;
          stream: "stdout" | "stderr";
        };

        if (chunk.stream === "stdout") {
          stdout += chunk.data;
        }

        yield { status: "streaming" as const, output: stdout };
      }

      yield {
        status: "complete" as const,
        output: finalResult!.stdout,
        stderr: finalResult!.stderr,
        exitCode: finalResult!.exitCode,
        ...(finalResult!.fromSnapshot === false && { fromSnapshot: false }),
        ...(finalResult!.runId && { runId: finalResult!.runId }),
      };

      return finalResult as never;
    },
  };
}
