import { z } from "zod";
import type { Tool } from "ai";
import { promptSandboxStreaming } from "@/lib/sandbox/promptSandboxStreaming";

const promptSandboxSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe("The prompt to send to OpenClaw running in the sandbox."),
});

interface SandboxStreamProgress {
  status: "booting" | "streaming" | "complete";
  output: string;
  stderr?: string;
  exitCode?: number;
}

interface PromptSandboxFinalResult {
  sandboxId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  created: boolean;
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
      "Streams output in real-time.",
    inputSchema: promptSandboxSchema,
    execute: async function* ({ prompt }, { abortSignal }) {
      yield { status: "booting" as const, output: "" };

      const gen = promptSandboxStreaming({
        accountId,
        apiKey,
        prompt,
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
      };

      return finalResult as never;
    },
  };
}
