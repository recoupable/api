/** Receipt from withdraw_context_request_source; counts come from recorded result lineage. */
export interface ContextSourceWithdrawalReceipt {
  contract_version: "context-source-withdrawal-v1";
  request_id: string;
  source_id: string;
  withdrawn_at: string;
  /** True when the source was already withdrawn; timestamps and revisions are untouched. */
  already_withdrawn: boolean;
  affected: {
    /** Saved results now withdrawn through any version of the source. */
    results: number;
    /** Documents whose current result is withheld because of this source. */
    documents: number;
    /** Every request whose saved attempts produced those results, including this one. */
    request_ids: string[];
  };
}
