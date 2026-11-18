/** Only configured server World readers supply evidence. Never adapt a route body to these ports. */
export type ProjectionEvidencePorts = {
  readRun: (runId: string, signal: AbortSignal) => Promise<unknown>;
  readStep: (runId: string, stepId: string, signal: AbortSignal) => Promise<unknown>;
  readReceipt: (
    runId: string,
    producerStepId: string,
    proofStepName: string,
    signal: AbortSignal,
  ) => Promise<unknown>;
  readCanonical: (runId: string, signal: AbortSignal) => Promise<unknown[]>;
};
export type ProjectionAuthority = { accountId: string; chatId: string; sessionId: string };
/** Server-reviewed deployment identities only. Empty means no producer is admitted. */
export type ProjectionProducer = {
  deploymentId: string;
  workflowName: string;
  stepName: string;
  proofStepName: string;
};
