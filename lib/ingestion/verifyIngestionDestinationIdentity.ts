import type { DestinationConfig } from "./destinationConfigSchema";
import type { IngestionSqlClient } from "./types";
/** Verify the protected marker before freezing a binding and again inside delivery. */
export async function verifyIngestionDestinationIdentity(
  config: DestinationConfig,
  client: IngestionSqlClient,
) {
  const identity = await client.query(
    `SELECT database_id::text FROM "${config.receipt_schema}"."destination_identity"`,
  );
  if (identity.rows.length !== 1 || identity.rows[0].database_id !== config.database_id)
    throw new Error("Destination identity mismatch");
}
