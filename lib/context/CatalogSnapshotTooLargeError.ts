/** Exact Catalog storage-size refusal; SQL guarantees this save was rolled back. */
export class CatalogSnapshotTooLargeError extends Error {
  readonly code = "catalog_snapshot_too_large";
  readonly status = 400;
  constructor() {
    super(
      "Catalog snapshot exceeds the 1 MiB stored JSON limit. Reduce the snapshot size; this save was not persisted.",
    );
    this.name = "CatalogSnapshotTooLargeError";
  }
}
