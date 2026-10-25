/** Non-secret observations from the existing verifier. Never an execution grant. */
export type VerifiedCredential =
  | { mechanism: "recoup_api_key"; keyId: string }
  | { mechanism: "privy"; appId: string; issuer: string; subject: string };

export type AccountAccessObservation =
  | { basis: "self" }
  | {
      basis: "admin_membership" | "organization_membership" | "shared_membership";
      organizationId: string;
    };

export type OrganizationAccessObservation = {
  basis: "self_organization" | "membership";
  organizationId: string;
};

export interface VerificationEvidence {
  principal: VerifiedCredential & { actorAccountId: string };
  effectiveAccountId: string;
  accountAccess: AccountAccessObservation;
  organizationAccess: OrganizationAccessObservation | null;
  executionResources: { status: "unresolved"; reason: "resource_authorization_contract_missing" };
}

export type CredentialObserver = (credential: VerifiedCredential) => void;
