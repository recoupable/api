import type { OAuthStore } from "../OAuthStore";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { hashOAuthIdentifier } from "../hashOAuthIdentifier";
import { agentRegistrationSchema, type AgentRegistration } from "./AgentRegistration";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";

/** Keep identity encrypted, handles HMAC-indexed, and every transition conditional on its read. */
export function createAgentRegistrationStore(config: OAuthRuntimeConfig, store: OAuthStore) {
  const model = "RecoupAgentRegistration";
  const namespace = config.issuer;
  const hash = (value: string) => hashOAuthIdentifier(namespace, config.indexKey, value);
  const context = (idHash: string) => [namespace, model, idHash] as const;
  return {
    hash,
    async insert(registration: AgentRegistration) {
      const record = agentRegistrationSchema.parse(registration);
      const idHash = hash(record.id);
      if (!store.purgeAgentRegistrations) throw new Error("Agent registration storage unavailable");
      await store.purgeAgentRegistrations(namespace);
      await store.upsert({
        namespace,
        model,
        idHash,
        payload: config.cipher.encrypt(record, context(idHash)),
        expiresIn: policy.claimSeconds + policy.connectionSeconds,
        // Predetermine the eventual grant ID so revocation also deletes the registration.
        grantHash: idHash,
        uidHash: record.claimHash,
        // This index stores the high-entropy browser handle, never the six-digit code.
        userCodeHash: record.attemptHash,
      });
    },
    async find(index: "id" | "uid" | "user_code", value: string) {
      const queryHash = hash(value);
      const stored = await store.find({ namespace, model, index, hash: queryHash });
      if (!stored) return undefined;
      if (!/^[a-f0-9]{64}$/.test(stored.id_hash)) throw new Error("Invalid agent registration");
      const record = agentRegistrationSchema.parse(
        config.cipher.decrypt(stored.payload, context(stored.id_hash)),
      );
      if (
        hash(record.id) !== stored.id_hash ||
        (index === "id"
          ? stored.id_hash
          : index === "uid"
            ? record.claimHash
            : record.attemptHash) !== queryHash
      )
        throw new Error("Invalid agent registration binding");
      return { record, ciphertext: stored.payload };
    },
    async replace(
      previous: { record: AgentRegistration; ciphertext: string },
      next: AgentRegistration,
    ) {
      if (!store.compareAndSwap) throw new Error("Agent registration storage unavailable");
      const record = agentRegistrationSchema.parse(next);
      for (const field of [
        "id",
        "claimHash",
        "attemptHash",
        "codeHash",
        "email",
        "createdAt",
        "claimExpiresAt",
      ] as const)
        if (record[field] !== previous.record[field])
          throw new Error("Invalid agent registration binding");
      const idHash = hash(record.id);
      return store.compareAndSwap({
        namespace,
        model,
        idHash,
        expectedPayload: previous.ciphertext,
        payload: config.cipher.encrypt(record, context(idHash)),
      });
    },
  };
}
