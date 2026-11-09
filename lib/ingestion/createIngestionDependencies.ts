import { authorizeIngestionScope } from "./authorizeIngestionScope";
import { readIngestionObject } from "@/lib/supabase/storage/readIngestionObject";
import { createIngestionObject } from "@/lib/supabase/storage/createIngestionObject";
import { acquireIngestionSource } from "./acquireIngestionSource";
import { deliverConfiguredIngestion } from "./deliverConfiguredIngestion";
import type { IngestionDependencies } from "./types";

/** Production ports; parsing and orchestration remain independently testable. */
export function createIngestionDependencies(
  dispatch: IngestionDependencies["dispatch"],
): IngestionDependencies {
  return {
    authorize: authorizeIngestionScope,
    store: { read: readIngestionObject, create: createIngestionObject },
    acquire: acquireIngestionSource,
    deliver: deliverConfiguredIngestion,
    dispatch,
  };
}
