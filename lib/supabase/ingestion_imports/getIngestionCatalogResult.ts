import supabase from "@/lib/supabase/serverClient";
import type { Json } from "@/types/database.types";
import type { IngestionDependencies } from "@/lib/ingestion/types";

/** Service-only gateway; the database rechecks and locks organization membership per transaction. */
export const getIngestionCatalogResult: IngestionDependencies["catalog"] = async (
  actor,
  organization,
  action,
  input,
) => {
  const { data, error } = await supabase.rpc("ingestion_catalog_command", {
    p_actor: actor,
    p_org: organization,
    p_action: action,
    p_input: input as Json,
  });
  if (error) {
    console.error("[ingestion] catalog command failed", {
      code: /^[A-Z0-9]{5}$/.test(error.code ?? "") ? error.code : "unknown",
    });
    if (error.code === "42501") throw new Error("Access denied");
    if (
      error.code === "P0001" &&
      ["Ingestion catalog conflict", "Artifact not ready"].includes(error.message)
    )
      throw new Error(error.message);
    throw new Error("Ingestion catalog unavailable");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Ingestion catalog unavailable");
  return data;
};
