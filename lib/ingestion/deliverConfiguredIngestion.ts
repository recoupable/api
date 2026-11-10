import { verifyIngestionDestinationIdentity } from "./verifyIngestionDestinationIdentity";
import { Client } from "pg";
import { destinationConfigsSchema } from "./destinationConfigSchema";
import { deliverIngestionToPostgres } from "./deliverIngestionToPostgres";
import type { GoldArtifact, ArtifactStore } from "./types";
import { writeIngestionArtifact } from "./writeIngestionArtifact";
import { hashIngestionValue } from "./hashIngestionValue";

/** Resolve destinations exclusively from server configuration, scoped to one account or organization. */
export async function deliverConfiguredIngestion(
  scope: string,
  destinationId: string,
  deliveryId: string,
  gold: GoldArtifact,
  digest: string,
  bindingStore: ArtifactStore,
) {
  const configs = (() => {
    try {
      return destinationConfigsSchema.parse(
        JSON.parse(process.env.INGESTION_DESTINATIONS_JSON ?? "[]"),
      );
    } catch {
      throw new Error("Destination configuration invalid");
    }
  })();
  const matches = configs.filter(c => c.scope === scope && c.id === destinationId);
  if (matches.length !== 1) throw new Error("Destination unavailable");
  const config = matches[0];
  const connectionString = process.env[config.connection_env];
  if (!connectionString) throw new Error("Destination unavailable");
  const bindingKey = `${scope}/destinations/${hashIngestionValue(destinationId)}/identity.json`;
  const identityBytes = Buffer.from(
    JSON.stringify({ database_id: config.database_id, config_sha256: hashIngestionValue(config) }),
  );
  const binding = await bindingStore.read(bindingKey);
  if (binding && !Buffer.from(binding).equals(identityBytes)) throw new Error("Artifact conflict");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname)
    throw new Error("Destination unavailable");
  // Prevent connection-string query parameters from overriding certificate verification.
  url.search = "";
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  client.on("error", () => {
    console.error("[ingestion] destination connection failed");
  });
  try {
    await client.connect();
    await verifyIngestionDestinationIdentity(config, client);
    await writeIngestionArtifact(bindingStore, bindingKey, identityBytes);
    return await deliverIngestionToPostgres(config, deliveryId, gold, digest, client);
  } finally {
    await client.end();
  }
}
