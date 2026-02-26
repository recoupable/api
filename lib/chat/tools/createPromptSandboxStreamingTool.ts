import { z } from "zod";
import { tool } from "ai";
import { promptSandboxStreaming } from "@/lib/sandbox/promptSandboxStreaming";

const promptSandboxSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe("The prompt to send to OpenClaw running in the sandbox."),
});

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
) {
  return tool({
    description:
      "Send a prompt to OpenClaw running in a persistent sandbox. " +
      "Reuses the account's existing running sandbox or creates one from the latest snapshot. " +
      "Streams output in real-time. The sandbox stays alive for follow-up prompts.",
    parameters: promptSandboxSchema,
    execute: async function* ({ prompt }, { abortSignal }) {
      yield { status: "booting" as const, output: "" };

      const gen = promptSandboxStreaming({
        accountId,
        apiKey,
        prompt,
        abortSignal,
      });

      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      let sandboxId = "";
      let created = false;

      while (true) {
        const { value, done } = await gen.next();

        if (done) {
          sandboxId = value.sandboxId;
          stdout = value.stdout;
          stderr = value.stderr;
          exitCode = value.exitCode;
          created = value.created;
          break;
        }

        if (value.stream === "stdout") {
          stdout += value.data;
        }

        yield { status: "streaming" as const, output: stdout };
      }

      yield {
        status: "complete" as const,
        output: stdout,
        stderr,
        exitCode,
      };

      return { sandboxId, stdout, stderr, exitCode, created };
    },
  });
}
