import { Client } from "pg";
import { z } from "zod";
import { destinationConfigSchema } from "./destinationConfigSchema";
import { deliverIngestionToPostgres } from "./deliverIngestionToPostgres";
import type { GoldArtifact } from "./types";

/** Resolve destinations exclusively from server configuration, scoped to one account or organization. */
export async function deliverConfiguredIngestion(
  scope: string,
  destinationId: string,
  deliveryId: string,
  gold: GoldArtifact,
  digest: string,
) {
  const configs = z
    .array(destinationConfigSchema)
    .parse(JSON.parse(process.env.INGESTION_DESTINATIONS_JSON ?? "[]"));
  const matches = configs.filter(c => c.scope === scope && c.id === destinationId);
  if (matches.length !== 1) throw new Error("Destination unavailable");
  const config = matches[0];
  const connectionString = process.env[config.connection_env];
  if (!connectionString) throw new Error("Destination unavailable");
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
  try {
    await client.connect();
    return await deliverIngestionToPostgres(config, deliveryId, gold, digest, client);
  } finally {
    await client.end();
  }
}
