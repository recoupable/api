import type { VercelSandboxConfig, VercelSandboxConnectConfig } from "../config";
import { VercelSandbox } from "./VercelSandbox";

export async function connectVercelSandbox(
  config: VercelSandboxConfig | VercelSandboxConnectConfig = {},
): Promise<VercelSandbox> {
  const connectConfig = config as VercelSandboxConnectConfig & {
    sandboxId?: string;
  };
  const sandboxName = connectConfig.sandboxName ?? connectConfig.sandboxId;

  if (sandboxName) {
    return VercelSandbox.connect(sandboxName, {
      env: connectConfig.env,
      githubToken: connectConfig.githubToken,
      hooks: connectConfig.hooks,
      remainingTimeout: connectConfig.remainingTimeout,
      ports: connectConfig.ports,
      resume: connectConfig.resume,
    });
  }

  return VercelSandbox.create(config as VercelSandboxConfig);
}
