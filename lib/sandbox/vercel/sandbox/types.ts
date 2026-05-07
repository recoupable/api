import type { Sandbox as VercelSandboxSDK } from "@vercel/sandbox";

export interface SandboxRouteLike {
  port: number;
}

export interface SandboxNetworkTransform {
  headers?: Record<string, string>;
}

export interface SandboxNetworkRule {
  transform?: SandboxNetworkTransform[];
}

export interface SandboxNetworkPolicy {
  allow: Record<string, SandboxNetworkRule[]>;
}

export type VercelSandboxSession = ReturnType<
  InstanceType<typeof VercelSandboxSDK>["currentSession"]
>;
