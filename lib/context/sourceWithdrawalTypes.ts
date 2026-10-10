/** Receipt from withdraw_context_request_source; counts come from recorded result lineage. */
export interface ContextSourceWithdrawalReceipt {
  contract_version: "context-source-withdrawal-v1";
  request_id: string;
  /** The withdrawn source, also when the caller named it by a version ID. */
  source_id: string;
  withdrawn_at: string;
  /** True when the source was already withdrawn; timestamps and revisions are untouched. */
  already_withdrawn: boolean;
  /** Recorded lineage of the source; identical on replay. */
  affected: {
    /** Saved results that depend on any version of the source; all are now withdrawn. */
    results: number;
    /** Documents holding such a result; any whose current result used the source now has none. */
    documents: number;
    /** Every request whose saved attempts produced those results, including this one. */
    request_ids: string[];
  };
}
