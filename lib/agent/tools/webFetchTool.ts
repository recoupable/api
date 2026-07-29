import { tool, type ToolExecutionOptions } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/lib/agent/tools/AgentContext";
import { buildRecoupExecEnv } from "@/lib/agent/tools/buildRecoupExecEnv";
import { getSandbox } from "@/lib/agent/tools/getSandbox";
import { shellEscape } from "@/lib/agent/tools/shellEscape";

const FETCH_TIMEOUT_MS = 30_000;
export const MAX_BODY_LENGTH = 10_000;

const fetchInputSchema = z.object({
  url: z.string().url().describe("The URL to fetch"),
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    .optional()
    .describe("HTTP method. Default: GET"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("Optional HTTP headers as key-value pairs"),
  body: z.string().optional().describe("Optional request body (for POST/PUT/PATCH)"),
});

const fetchOutputSchema = z.union([
  z.object({
    success: z.literal(true),
    status: z.number().int().nullable(),
    body: z.string(),
    truncated: z.boolean(),
  }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

/**
 * `web_fetch` — make an HTTP request from inside the sandbox via curl.
 * Lives in the sandbox (not on the worker) so requests come from the
 * sandbox's network egress, can reuse its env, and don't bypass any
 * sandbox-level policies. Truncates response bodies to 10KB to protect
 * model context.
 */
export const webFetchTool = tool({
  description: `Fetch a URL from the web.

USAGE:
- Make HTTP requests to external URLs
- Supports GET, POST, PUT, PATCH, DELETE, and HEAD methods
- Returns the response status and body text
- Body is truncated to ${MAX_BODY_LENGTH} characters to avoid overwhelming context`,
  inputSchema: fetchInputSchema,
  outputSchema: fetchOutputSchema,
  execute: async (
    { url, method: methodInput, headers, body },
    { context: experimental_context, abortSignal }: ToolExecutionOptions<AgentContext>,
  ) => {
    // Default applied in-body rather than via a destructure default: combined
    // with `outputSchema`, a parameter default poisons the AI SDK v7 `tool()`
    // INPUT inference and breaks the typed-overload resolution.
    const method = methodInput ?? "GET";
    const sandbox = await getSandbox(experimental_context, "web_fetch");
    const workingDirectory = sandbox.workingDirectory;
    const recoupEnv = buildRecoupExecEnv(experimental_context);

    const args: string[] = [
      "curl",
      "-sS",
      "-X",
      method,
      "--max-time",
      String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
      "-o",
      `>(head -c ${MAX_BODY_LENGTH} >&3)`,
      "-w",
      shellEscape("%{http_code}"),
    ];

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        args.push("-H", shellEscape(`${key}: ${value}`));
      }
    }
    if (method !== "GET" && method !== "HEAD" && body) {
      args.push("-d", shellEscape(body));
    }
    args.push(shellEscape(url));

    // Use fd 3 to split curl's response body (truncated by `head -c`) from
    // the status code written via `-w`. The body goes to stdout via fd 3
    // → fd 1, then we append the status code on its own newline.
    const command = [
      "exec 3>&1",
      `status=$(${args.join(" ")})`,
      "curlExit=$?",
      "exec 3>&-",
      "printf '\\n%s' \"$status\"",
      "exit $curlExit",
    ].join("\n");

    try {
      const result = await sandbox.exec(command, workingDirectory, FETCH_TIMEOUT_MS, {
        signal: abortSignal,
        ...(recoupEnv ? { env: recoupEnv } : {}),
      });

      // exit 23 = curl wrote partial output (`head -c` cut it off — expected for large responses).
      if (result.exitCode !== 0 && result.exitCode !== 23) {
        return {
          success: false as const,
          error: `Fetch failed: ${result.stderr || result.stdout || "Unknown error"}`,
        };
      }

      const output = result.stdout ?? "";
      const lastNewline = output.lastIndexOf("\n");
      const statusText = lastNewline !== -1 ? output.slice(lastNewline + 1).trim() : "";
      const responseBody = lastNewline !== -1 ? output.slice(0, lastNewline) : output;
      const status = /^\d+$/.test(statusText) ? parseInt(statusText, 10) : null;

      return {
        success: true as const,
        status,
        body: responseBody,
        truncated: result.exitCode === 23,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false as const, error: `Fetch failed: ${message}` };
    }
  },
});
