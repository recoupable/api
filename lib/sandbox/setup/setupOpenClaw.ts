import type { Sandbox } from "@vercel/sandbox";
import type { SetupDeps } from "./types";

/**
 * Ensures OpenClaw is onboarded, seeds env vars into the config,
 * and starts the gateway process in the background.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 * @param apiKey - The RECOUP_API_KEY to inject
 * @param deps - Logging dependencies
 */
export async function setupOpenClaw(
  sandbox: Sandbox,
  accountId: string,
  apiKey: string,
  deps: SetupDeps,
): Promise<void> {
  // Check if already onboarded
  const configCheck = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "test -f ~/.openclaw/openclaw.json"],
  });

  if (configCheck.exitCode !== 0) {
    // Run onboard
    const onboardArgs = [
      "onboard",
      "--non-interactive",
      "--mode",
      "local",
      "--auth-choice",
      "ai-gateway-api-key",
      "--ai-gateway-api-key",
      process.env.VERCEL_AI_GATEWAY_API_KEY!,
      "--gateway-port",
      "18789",
      "--gateway-bind",
      "loopback",
      "--accept-risk",
    ];

    deps.log("Running OpenClaw onboard");

    const onboard = await sandbox.runCommand({
      cmd: "openclaw",
      args: onboardArgs,
    });

    if (onboard.exitCode !== 0) {
      const stdout = (await onboard.stdout()) || "";
      const stderr = (await onboard.stderr()) || "";
      // Onboard writes config but may exit non-zero when it can't verify gateway
      deps.log("OpenClaw onboard exited with non-zero code (may be expected)", {
        exitCode: onboard.exitCode,
        stdout,
        stderr,
      });
    }
  } else {
    deps.log("OpenClaw already onboarded, skipping");
  }

  // Inject env vars into openclaw.json
  const githubToken = process.env.GITHUB_TOKEN;

  const injectEnv = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `node -e "
        const fs = require('fs');
        const p = require('os').homedir() + '/.openclaw/openclaw.json';
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        c.env = c.env || {};
        c.env.RECOUP_API_KEY = '${apiKey}';
        c.env.RECOUP_ACCOUNT_ID = '${accountId}';
        ${githubToken ? `c.env.GITHUB_TOKEN = '${githubToken}';` : ""}
        fs.writeFileSync(p, JSON.stringify(c, null, 2));
      "`,
    ],
  });

  if (injectEnv.exitCode !== 0) {
    const stderr = (await injectEnv.stderr()) || "";
    deps.error("Failed to inject env vars into openclaw.json", {
      exitCode: injectEnv.exitCode,
      stderr,
    });
    throw new Error("Failed to inject env vars into openclaw.json");
  }

  deps.log("OpenClaw onboard complete, starting gateway");

  // Start gateway in background
  const gateway = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "nohup openclaw gateway run > /tmp/gateway.log 2>&1 &"],
  });

  if (gateway.exitCode !== 0) {
    const stdout = (await gateway.stdout()) || "";
    const stderr = (await gateway.stderr()) || "";
    deps.error("Failed to start OpenClaw gateway", {
      exitCode: gateway.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to start OpenClaw gateway");
  }

  deps.log("OpenClaw gateway started");
}
