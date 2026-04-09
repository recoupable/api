import { beforeEach, describe, expect, it, vi } from "vitest";
import { listFilesByArtist } from "../listFilesByArtist";
import { getFilesByArtistId } from "@/lib/supabase/files/getFilesByArtistId";

vi.mock("@/lib/supabase/files/getFilesByArtistId", () => ({
  getFilesByArtistId: vi.fn(),
}));

const files = [
  {
    id: "1",
    owner_account_id: "owner-1",
    artist_account_id: "artist-1",
    file_name: "root.txt",
    storage_key: "files/owner-1/artist-1/root.txt",
    mime_type: "text/plain",
    is_directory: false,
    size_bytes: 10,
    description: null,
    tags: null,
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "2",
    owner_account_id: "owner-1",
    artist_account_id: "artist-1",
    file_name: "reports",
    storage_key: "files/owner-1/artist-1/reports/",
    mime_type: null,
    is_directory: true,
    size_bytes: null,
    description: null,
    tags: null,
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "3",
    owner_account_id: "owner-2",
    artist_account_id: "artist-1",
    file_name: "weekly.md",
    storage_key: "files/owner-2/artist-1/reports/weekly.md",
    mime_type: "text/markdown",
    is_directory: false,
    size_bytes: 20,
    description: null,
    tags: null,
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "4",
    owner_account_id: "owner-2",
    artist_account_id: "artist-1",
    file_name: "april.md",
    storage_key: "files/owner-2/artist-1/reports/monthly/april.md",
    mime_type: "text/markdown",
    is_directory: false,
    size_bytes: 20,
    description: null,
    tags: null,
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
];

describe("listFilesByArtist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFilesByArtistId).mockResolvedValue(files);
  });

  it("returns only root-level entries when no path is provided", async () => {
    const result = await listFilesByArtist("artist-1");

    expect(result.map(file => file.id)).toEqual(["1", "2"]);
  });

  it("returns only immediate children for a nested path", async () => {
    const result = await listFilesByArtist("artist-1", "reports");

    expect(result.map(file => file.id)).toEqual(["3"]);
  });

  it("returns all descendants when recursive is true", async () => {
    const result = await listFilesByArtist("artist-1", "reports", true);

    expect(result.map(file => file.id)).toEqual(["2", "3", "4"]);
  });
});
