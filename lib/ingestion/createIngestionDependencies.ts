import { getIngestionCatalogResult } from "@/lib/supabase/ingestion_imports/getIngestionCatalogResult";
import { authorizeIngestionScope } from "./authorizeIngestionScope";
import { readIngestionObject } from "@/lib/supabase/storage/readIngestionObject";
import { createIngestionObject } from "@/lib/supabase/storage/createIngestionObject";
import { acquireIngestionSource } from "./acquireIngestionSource";
import { deliverConfiguredIngestion } from "./deliverConfiguredIngestion";
import type { IngestionDependencies } from "./types";
import { limitIngestionRequest } from "./limitIngestionRequest";

/** Production ports; parsing and orchestration remain independently testable. */
export function createIngestionDependencies(
  dispatch: IngestionDependencies["dispatch"],
): IngestionDependencies {
  const store = { read: readIngestionObject, create: createIngestionObject };
  return {
    authorize: authorizeIngestionScope,
    catalog: getIngestionCatalogResult,
    limit: limitIngestionRequest,
    store,
    acquire: acquireIngestionSource,
    deliver: (...args) => deliverConfiguredIngestion(...args, store),
    dispatch,
  };
}
