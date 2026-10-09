export const actor = "11111111-1111-4111-8111-111111111111";
export const owner = "22222222-2222-4222-8222-222222222222";
export const source = "33333333-3333-4333-8333-333333333333";
export const id = "44444444-4444-4444-8444-444444444444";
export const version = "55555555-5555-4555-8555-555555555555";
export const object = "66666666-6666-4666-8666-666666666666";
export const key = `${owner}/context-originals/${object}.csv`;
export const input = { sourceId: source, idempotencyKey: "import-1", fileKey: key };
export const verified = {
  bucket: "context-private" as const,
  key,
  sha256: "a".repeat(64),
  bytes: 26,
  mediaType: "text/csv",
};
export const receipt = {
  id,
  owner_id: owner,
  source_id: source,
  source_version_id: version,
  fingerprint: verified.sha256,
  bytes: 26,
  media_type: "text/csv",
  status: "registered",
  evidence_kind: "customer_assertion",
  created_at: "2026-10-09T20:00:00Z",
};
