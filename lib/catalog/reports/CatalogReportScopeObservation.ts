import type { VerificationEvidence } from "@/lib/auth/VerificationEvidence";

/** Current request observations, never a durable grant or scheduled-creator reauthorization. */
export interface CatalogReportScopeObservation {
  catalogId: string;
  organizationId: string | null;
  ownerAccountId: string;
  effectiveAccountId: string;
  principal: VerificationEvidence["principal"];
  accountAccess: VerificationEvidence["accountAccess"];
  organizationAccess: VerificationEvidence["organizationAccess"];
  observedAt: string;
  provenance: {
    authentication: "validateAuthContext";
    catalogLink: "account_catalogs";
  };
  executionAuthorization: "not_granted";
}
