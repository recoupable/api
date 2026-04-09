import { beforeEach, describe, expect, it, vi } from "vitest";
import { enrichFiles } from "../enrichFiles";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

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

describe("enrichFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns files with owner_email when one exists", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([
      {
        id: "email-1",
        account_id: "550e8400-e29b-41d4-a716-446655440100",
        email: "owner@example.com",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
    ]);

    const result = await enrichFiles([baseFile]);

    expect(selectAccountEmails).toHaveBeenCalledWith({
      accountIds: ["550e8400-e29b-41d4-a716-446655440100"],
    });
    expect(result).toEqual([{ ...baseFile, owner_email: "owner@example.com" }]);
  });

  it("returns owner_email as null when no email row exists", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await enrichFiles([baseFile]);

    expect(result).toEqual([{ ...baseFile, owner_email: null }]);
  });

  it("deduplicates owner account IDs before fetching emails", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([
      {
        id: "email-1",
        account_id: "550e8400-e29b-41d4-a716-446655440100",
        email: "owner@example.com",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
    ]);

    await enrichFiles([
      baseFile,
      {
        ...baseFile,
        id: "550e8400-e29b-41d4-a716-446655440011",
        file_name: "second.md",
      },
    ]);

    expect(selectAccountEmails).toHaveBeenCalledTimes(1);
    expect(selectAccountEmails).toHaveBeenCalledWith({
      accountIds: ["550e8400-e29b-41d4-a716-446655440100"],
    });
  });

  it("uses the most recently updated email when an owner has multiple rows", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([
      {
        id: "email-older",
        account_id: "550e8400-e29b-41d4-a716-446655440100",
        email: "older@example.com",
        updated_at: "2026-04-08T00:00:00.000Z",
      },
      {
        id: "email-newer",
        account_id: "550e8400-e29b-41d4-a716-446655440100",
        email: "newer@example.com",
        updated_at: "2026-04-09T00:00:00.000Z",
      },
    ]);

    const result = await enrichFiles([baseFile]);

    expect(result).toEqual([{ ...baseFile, owner_email: "newer@example.com" }]);
  });

  it("returns an empty array without fetching emails when no files match", async () => {
    const result = await enrichFiles([]);

    expect(selectAccountEmails).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
