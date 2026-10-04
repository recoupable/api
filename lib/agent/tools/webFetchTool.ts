import { tool } from "ai";
import { z } from "zod";
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
    { url, method = "GET", headers, body },
    { experimental_context, abortSignal },
  ) => {
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
      '"$tmp"',
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

    // Write the body to a temp file rather than a process substitution: `>(…)`
    // is a bash-ism that does not expand in the sandbox's exec shell, so curl
    // wrote to a file literally named `>(head -c … >&3)`, failed, and exited 23
    // with an empty body — which the old exit-23 branch reported as a truncated
    // success (chat#1918). stdout contract: `status\nbyteSize\n<body>`, so the
    // real size is known even though the body itself is capped for context.
    const command = [
      "tmp=$(mktemp)",
      `status=$(${args.join(" ")})`,
      "curlExit=$?",
      'size=$(wc -c < "$tmp" | tr -d " ")',
      'printf \'%s\\n%s\\n\' "$status" "$size"',
      `head -c ${MAX_BODY_LENGTH} "$tmp"`,
      'rm -f "$tmp"',
      "exit $curlExit",
    ].join("\n");

    try {
      const result = await sandbox.exec(command, workingDirectory, FETCH_TIMEOUT_MS, {
        signal: abortSignal,
        ...(recoupEnv ? { env: recoupEnv } : {}),
      });

      const output = result.stdout ?? "";
      const firstNewline = output.indexOf("\n");
      const secondNewline = output.indexOf("\n", firstNewline + 1);
      const statusText = firstNewline === -1 ? "" : output.slice(0, firstNewline).trim();
      const sizeText =
        secondNewline === -1 ? "" : output.slice(firstNewline + 1, secondNewline).trim();
      const responseBody = secondNewline === -1 ? "" : output.slice(secondNewline + 1);
      const status = /^\d+$/.test(statusText) && statusText !== "000" ? Number(statusText) : null;
      const size = /^\d+$/.test(sizeText) ? Number(sizeText) : responseBody.length;

      // A nonzero exit that produced no bytes is a hard failure. Reporting it as
      // an empty-bodied 200 is what made agents conclude the whole web was
      // unreachable; surface it so they retry or report instead.
      if (result.exitCode !== 0 && size === 0) {
        return {
          success: false,
          error: `Fetch failed (exit ${result.exitCode}): ${
            result.stderr || "no response body written"
          }`,
        };
      }

      return {
        success: true,
        status,
        body: responseBody,
        // Truncation is a property of the response size, not of curl's exit code.
        truncated: size > MAX_BODY_LENGTH,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Fetch failed: ${message}` };
    }
  },
});
