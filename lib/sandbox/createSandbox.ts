import { Writable } from "stream";
import { Sandbox } from "@vercel/sandbox";

export interface SandboxConfig {
  timeout?: number;
  runtime?: "node22" | "node20" | "node18";
  vcpus?: number;
}

export interface SandboxResult {
  sandboxId: string;
  output: string;
  exitCode: number;
}

/**
 * Creates a writable stream that collects data into an array.
 *
 * @param chunks - Array to collect output chunks
 * @returns A Writable stream
 */
function createCollectorStream(chunks: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
}

/**
 * Creates a Vercel Sandbox, installs Claude's Agent SDK, and executes a script.
 *
 * @param script - The JavaScript/TypeScript script to execute
 * @param config - Optional sandbox configuration
 * @returns The sandbox execution result
 * @throws Error if sandbox creation or script execution fails
 */
export async function createSandbox(
  script: string,
  config: SandboxConfig = {},
): Promise<SandboxResult> {
  const { timeout = 5 * 60 * 1000, runtime = "node22", vcpus = 4 } = config;

  const sandbox = await Sandbox.create({
    resources: { vcpus },
    timeout,
    runtime,
  });

  try {
    const installOutput: string[] = [];
    const installSDK = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "@anthropic-ai/sdk"],
      stdout: createCollectorStream(installOutput),
      stderr: createCollectorStream(installOutput),
    });

    if (installSDK.exitCode !== 0) {
      throw new Error(`Failed to install Anthropic SDK: ${installOutput.join("")}`);
    }

    await sandbox.writeFiles([
      {
        path: "/vercel/sandbox/script.mjs",
        content: Buffer.from(script),
      },
    ]);

    const scriptOutput: string[] = [];
    const runScript = await sandbox.runCommand({
      cmd: "node",
      args: ["script.mjs"],
      stdout: createCollectorStream(scriptOutput),
      stderr: createCollectorStream(scriptOutput),
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
      },
    });

    return {
      sandboxId: sandbox.sandboxId,
      output: scriptOutput.join(""),
      exitCode: runScript.exitCode,
    };
  } finally {
    await sandbox.stop();
  }
}
