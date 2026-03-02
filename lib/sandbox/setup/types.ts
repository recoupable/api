import type { Sandbox } from "@vercel/sandbox";

export interface SetupDeps {
  log: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
}

export interface SetupContext {
  sandbox: Sandbox;
  accountId: string;
  apiKey: string;
  deps: SetupDeps;
}
