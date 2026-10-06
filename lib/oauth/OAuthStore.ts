export type OAuthStoredRecord = { id_hash: string; payload: string; consumed: number | null };
export type OAuthRecordKey = { namespace: string; model: string; idHash: string };
export interface OAuthStore {
  upsert(
    record: OAuthRecordKey & {
      payload: string;
      expiresIn: number | null;
      grantHash: string | null;
      uidHash: string | null;
      userCodeHash: string | null;
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
}
