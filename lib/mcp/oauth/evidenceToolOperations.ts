import type { EvidenceAttachmentOperation } from "@/lib/context/evidenceAttachmentSchemas";

/** Private evidence metadata; delegated organization grants are not yet audited. */
export const evidenceToolOperations = {
  attach_evidence: {
    name: "attach_music_evidence",
    description:
      "Associate an exact retained source version with existing authorized artist, professional or Context request/subject records. Relevance only; does not confirm identities, rights or mandates. Reuse the same key on retries.",
    readOnly: false,
    delegated: false,
  },
  read_evidence_attachment: {
    name: "read_music_evidence_attachment",
    description:
      "Read an evidence association receipt under current workspace, source and target access. Withdrawn or inaccessible evidence is withheld.",
    readOnly: true,
    delegated: false,
  },
  list_evidence_attachments: {
    name: "list_music_evidence_attachments",
    description:
      "List a bounded page of associations for an exact source version. Pass the returned next_id as after_id while has_more is true, including empty pages with withheld receipts.",
    readOnly: true,
    delegated: false,
  },
} satisfies Record<
  EvidenceAttachmentOperation["action"],
  { name: string; description: string; readOnly: boolean; delegated: false }
>;
