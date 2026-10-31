export type OAuthStoredRecord = { id_hash: string; payload: string; consumed: number | null };
export type OAuthRecordKey = { namespace: string; model: string; idHash: string };
export interface OAuthStore {
  purgeAgentRegistrations?(namespace: string): Promise<number>;
  compareAndSwap?(
    record: OAuthRecordKey & { expectedPayload: string; payload: string },
  ): Promise<boolean>;
  upsert(
    record: OAuthRecordKey & {
      payload: string;
      expiresIn: number | null;
      grantHash: string | null;
      uidHash: string | null;
      userCodeHash: string | null;
      accountHash?: string | null;
    },
  ): Promise<void>;
  find(query: {
    namespace: string;
    model: string;
    index: "id" | "uid" | "user_code";
    hash: string;
  }): Promise<OAuthStoredRecord | null>;
  consume(key: OAuthRecordKey): Promise<boolean>;
  destroy(key: OAuthRecordKey): Promise<void>;
  revokeGrant(namespace: string, grantHash: string): Promise<void>;
  listConnections?(namespace: string, accountHash: string): Promise<OAuthStoredRecord[]>;
}
