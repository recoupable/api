import type { SandboxNetworkPolicy } from "./types";

export const MAX_OUTPUT_LENGTH = 50_000;
export const DEFAULT_WORKING_DIRECTORY = "/vercel/sandbox";
export const TIMEOUT_BUFFER_MS = 30_000; // 30 seconds buffer for beforeStop hook
export const MAX_SDK_TIMEOUT_MS = 18_000_000; // Vercel API limit: 5 hours
export const MAX_PROACTIVE_TIMEOUT_MS = MAX_SDK_TIMEOUT_MS - TIMEOUT_BUFFER_MS;
export const DEFAULT_RECONNECT_TIMEOUT_MS = 300_000; // 5 minutes default timeout for reconnected sandboxes
export const DETACHED_QUICK_FAILURE_WINDOW_MS = 2_000;

export const DEFAULT_NETWORK_POLICY: SandboxNetworkPolicy = {
  allow: {
    "*": [],
  },
};
