import { Writable } from "stream";
import ms from "ms";
import { Sandbox } from "@vercel/sandbox";

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
 * Creates a Vercel Sandbox, installs Claude Code CLI and Anthropic SDK, then executes a script.
 *
 * @param script - The JavaScript/TypeScript script to execute
 * @returns The sandbox execution result
 * @throws Error if sandbox creation or dependency installation fails
 */
export async function createSandbox(script: string): Promise<SandboxResult> {
  const sandbox = await Sandbox.create({
    resources: { vcpus: 4 },
    timeout: ms("10m"),
    runtime: "node22",
  });
  console.log(`Sandbox created: ${sandbox.sandboxId}`);

  try {
    console.log(`Installing Claude Code CLI...`);
    const installCLI = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "-g", "@anthropic-ai/claude-code"],
      stderr: process.stderr,
      stdout: process.stdout,
      sudo: true,
    });

    if (installCLI.exitCode !== 0) {
      console.log("Installing Claude Code CLI failed");
      throw new Error("Failed to install Claude Code CLI");
    }
    console.log(`✓ Claude Code CLI installed`);

    console.log(`Installing Anthropic SDK...`);
    const installSDK = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "@anthropic-ai/sdk"],
      stderr: process.stderr,
      stdout: process.stdout,
    });

    if (installSDK.exitCode !== 0) {
      console.log("Installing Anthropic SDK failed");
      throw new Error("Failed to install Anthropic SDK");
    }
    console.log(`✓ Anthropic SDK installed`);

    console.log(`Verifying SDK connection...`);
    const verifyScript = `
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();
console.log('SDK imported successfully');
console.log('SDK is ready to use');
`;
    await sandbox.writeFiles([
      {
        path: "/vercel/sandbox/verify.mjs",
        content: Buffer.from(verifyScript),
      },
    ]);

    const verifyRun = await sandbox.runCommand({
      cmd: "node",
      args: ["verify.mjs"],
      stderr: process.stderr,
      stdout: process.stdout,
    });

    if (verifyRun.exitCode !== 0) {
      console.log("SDK verification failed");
      throw new Error("Failed to verify Anthropic SDK");
    }
    console.log(`✓ Anthropic SDK is properly connected`);

    console.log(`Executing script...`);
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

    console.log(`✓ Script executed`);
    return {
      sandboxId: sandbox.sandboxId,
      output: scriptOutput.join(""),
      exitCode: runScript.exitCode,
    };
  } finally {
    await sandbox.stop();
    console.log(`Sandbox stopped`);
  }
}
