export type CatalogSongInput = {
  catalog_id: string;
  isrc: string;
  name?: string;
  album?: string;
  notes?: string;
  artists?: string[];
};
