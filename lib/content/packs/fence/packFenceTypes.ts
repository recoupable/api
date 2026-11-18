/** Internal only: never accepted from public Pack brief or route input. */
export type PackLaunchFence = {
  expected_revision: number;
  execution_id: string;
  execution_version: number;
};
export type PackExecutionFence = PackLaunchFence & { workflow_run_id: string };
export type PackAssetFence = PackExecutionFence & { asset_attempt: number; claim_id: string };
export type PackProtocol2Admission = {
  protocol: 2;
  transition?: {
    request_id: string;
    source_execution_id: string | null;
    source_execution_version: number;
    source_claim_id?: string;
    asset_attempt?: number;
  };
};
export type PackProviderReceipt = {
  state: string;
  operation_id?: string;
  request_id?: string;
  data?: unknown;
  model?: string;
  input_sha256?: string;
  charge_credits?: number;
};
