import type { Json } from "./database.types";

export type CatalogStreamTracking = {
  catalog_id: string;
  owner_id: string;
  enabled: boolean;
  revision: string;
  updated_at: string;
};
export type CatalogStreamRun = {
  id: string;
  catalog_id: string;
  revision: string;
  scheduled_day: string;
  since: string;
  until: string;
  status: "queued" | "running" | "complete" | "partial" | "failed" | "cancelled";
  coverage: Json;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};
export type CatalogStreamObservation = {
  run_id: string;
  catalog_id: string;
  isrc: string;
  date: string;
  streams: number | null;
  provider_recording_id: string;
  source_hash: string;
  retrieved_at: string;
};
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: [] };
/** Schema additions for migration 20261009193000; retain generated baseline until next schema generation. */
export type CatalogStreamTables = {
  catalog_stream_tracking: Table<
    CatalogStreamTracking,
    Pick<CatalogStreamTracking, "catalog_id" | "owner_id"> & Partial<CatalogStreamTracking>
  >;
  catalog_stream_runs: Table<
    CatalogStreamRun,
    Pick<CatalogStreamRun, "catalog_id" | "revision" | "scheduled_day" | "since" | "until"> &
      Partial<CatalogStreamRun>
  >;
  catalog_stream_observations: Table<CatalogStreamObservation, CatalogStreamObservation>;
};
export type CatalogStreamFunctions = {
  read_catalog_stream_days: {
    Args: { p_catalog_id: string; p_isrc: string; p_since: string; p_until: string };
    Returns: CatalogStreamObservation[];
  };
  claim_catalog_stream_run: {
    Args: { p_catalog_id: string; p_day: string };
    Returns: CatalogStreamRun[];
  };
  commit_catalog_stream_track: {
    Args: { p_run_id: string; p_isrc: string; p_result: Json };
    Returns: boolean;
  };
};
