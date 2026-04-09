import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { getFilesHandler } from "../getFilesHandler";
import { validateGetFilesQuery } from "../validateGetFilesQuery";
import { listFilesByArtist } from "../listFilesByArtist";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetFilesQuery", () => ({
  validateGetFilesQuery: vi.fn(),
}));

vi.mock("../listFilesByArtist", () => ({
  listFilesByArtist: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

/**
 * Creates a mock request for GET /api/files tests.
 *
 * @returns A mocked NextRequest instance.
 */
function createRequest(): NextRequest {
  return {
    url: "http://localhost/api/files",
    headers: new Headers({ authorization: "Bearer token" }),
  } as unknown as NextRequest;
}

const baseFile = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  owner_account_id: "550e8400-e29b-41d4-a716-446655440100",
  artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
  file_name: "report.md",
  storage_key:
    "files/550e8400-e29b-41d4-a716-446655440100/550e8400-e29b-41d4-a716-446655440000/report.md",
  mime_type: "text/markdown",
  is_directory: false,
  size_bytes: 123,
  description: null,
  tags: null,
  created_at: "2026-04-09T00:00:00.000Z",
  updated_at: "2026-04-09T00:00:00.000Z",
};

describe("getFilesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation response errors directly", async () => {
    vi.mocked(validateGetFilesQuery).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await getFilesHandler(createRequest());

    expect(result.status).toBe(401);
  });

  it("returns files with owner_email when one exists", async () => {
    vi.mocked(validateGetFilesQuery).mockResolvedValue({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      recursive: false,
      requesterAccountId: "acc",
    });
    vi.mocked(listFilesByArtist).mockResolvedValue([baseFile]);
    vi.mocked(selectAccountEmails).mockResolvedValue([
      {
        id: "email-1",
        account_id: "550e8400-e29b-41d4-a716-446655440100",
        email: "owner@example.com",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
    ]);

    const result = await getFilesHandler(createRequest());
    const body = await result.json();

    expect(listFilesByArtist).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000",
      undefined,
      false,
    );
    expect(selectAccountEmails).toHaveBeenCalledWith({
      accountIds: ["550e8400-e29b-41d4-a716-446655440100"],
    });
    expect(result.status).toBe(200);
    expect(body).toEqual({
      files: [{ ...baseFile, owner_email: "owner@example.com" }],
    });
  });

  it("returns owner_email as null when no email row exists", async () => {
    vi.mocked(validateGetFilesQuery).mockResolvedValue({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      recursive: false,
      requesterAccountId: "acc",
    });
    vi.mocked(listFilesByArtist).mockResolvedValue([baseFile]);
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await getFilesHandler(createRequest());
    const body = await result.json();

    expect(body).toEqual({
      files: [{ ...baseFile, owner_email: null }],
    });
  });

  it("deduplicates owner account IDs before fetching emails", async () => {
    vi.mocked(validateGetFilesQuery).mockResolvedValue({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      recursive: true,
      requesterAccountId: "acc",
    });
    vi.mocked(listFilesByArtist).mockResolvedValue([
      baseFile,
      {
        ...baseFile,
        id: "550e8400-e29b-41d4-a716-446655440011",
        file_name: "second.md",
      },
    ]);
    vi.mocked(selectAccountEmails).mockResolvedValue([
      {
        id: "email-1",
        account_id: "550e8400-e29b-41d4-a716-446655440100",
        email: "owner@example.com",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
    ]);

    await getFilesHandler(createRequest());

    expect(selectAccountEmails).toHaveBeenCalledTimes(1);
    expect(selectAccountEmails).toHaveBeenCalledWith({
      accountIds: ["550e8400-e29b-41d4-a716-446655440100"],
    });
  });

  it("returns an empty files array without fetching emails when no files match", async () => {
    vi.mocked(validateGetFilesQuery).mockResolvedValue({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      recursive: false,
      requesterAccountId: "acc",
    });
    vi.mocked(listFilesByArtist).mockResolvedValue([]);

    const result = await getFilesHandler(createRequest());
    const body = await result.json();

    expect(selectAccountEmails).not.toHaveBeenCalled();
    expect(body).toEqual({ files: [] });
  });

  it("returns 500 when file lookup throws", async () => {
    vi.mocked(validateGetFilesQuery).mockResolvedValue({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      recursive: false,
      requesterAccountId: "acc",
    });
    vi.mocked(listFilesByArtist).mockRejectedValue(new Error("db blew up"));

    const result = await getFilesHandler(createRequest());

    expect(result.status).toBe(500);
    await expect(result.json()).resolves.toMatchObject({
      error: "db blew up",
    });
  });
});
