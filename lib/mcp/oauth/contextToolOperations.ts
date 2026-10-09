import type { z } from "zod";
import type { contextOperationSchema } from "@/lib/context/processContextOperation";

type Action = z.infer<typeof contextOperationSchema>["action"];
/** Each public operation has its own schema and permission classification. */
export const contextToolOperations = {
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
      "List a bounded page of associations for an exact source version. Continue with next_id while has_more is true, including empty pages with withheld receipts.",
    readOnly: true,
    delegated: false,
  },
  list_release_cases: {
    name: "list_music_release_cases",
    description: "List saved release cases and their review status.",
    readOnly: true,
  },
  read_release_case: {
    name: "read_music_release_case",
    description: "Read a saved release case and its evidence.",
    readOnly: true,
  },
  read_release_case_review: {
    name: "read_music_release_case_review",
    description: "Read a saved release case review.",
    readOnly: true,
  },
  review_release_case: {
    name: "record_music_release_case_review",
    description:
      "Save a release case review decision and optional note. This does not approve rights or distribution.",
    readOnly: false,
  },
  save_brief: {
    name: "save_music_context_brief",
    description:
      "Compile and save a creative direction or playlist pitch brief from saved music context.",
    readOnly: false,
  },
  read_brief: {
    name: "read_music_context_brief",
    description: "Read a previously saved music brief.",
    readOnly: true,
  },
  plan: {
    name: "plan_music_context_research",
    description: "Preview research modules for saved music context without running them.",
    readOnly: true,
  },
  list_executions: {
    name: "list_music_context_executions",
    description: "List research executions for a saved music context request.",
    readOnly: true,
  },
  list_catalog_members: {
    name: "list_music_context_catalog_members",
    description: "Read a page of saved catalog recordings.",
    readOnly: true,
  },
  list_release_tracks: {
    name: "list_music_context_release_tracks",
    description: "Read a page of saved release track slots.",
    readOnly: true,
  },
  read_release_track_observations: {
    name: "read_music_release_track_observations",
    description: "Read saved release track observations and evidence.",
    readOnly: true,
  },
  review_release_track_identities: {
    name: "review_music_release_track_identities",
    description: "Read the identity review for saved release tracks. Does not approve rights.",
    readOnly: true,
  },
  verify_release_tracks: {
    name: "verify_music_release_tracks",
    description:
      "Start provider verification of saved release tracks and save resulting observations.",
    readOnly: false,
  },
  expand_catalog_members: {
    name: "expand_music_context_catalog",
    description: "Save context subjects for a page of catalog recordings.",
    readOnly: false,
  },
  plan_catalog_members: {
    name: "plan_music_catalog_research",
    description:
      "Preview research modules for a page of saved catalog recordings without running them.",
    readOnly: true,
  },
  read_execution: {
    name: "read_music_context_execution",
    description: "Read the status and results of a saved research execution.",
    readOnly: true,
  },
  ingest_catalog: {
    name: "import_catalog_context",
    description: "Create a context request from a catalog you can access.",
    readOnly: false,
  },
  ingest_artist: {
    name: "import_artist_context",
    description: "Create a context request from an artist you can access.",
    readOnly: false,
  },
  ingest_songwriter_name: {
    name: "import_songwriter_context",
    description:
      "Create a context request from a submitted songwriter name. A name is not verified identity.",
    readOnly: false,
  },
  ingest_company_name: {
    name: "import_music_company_context",
    description:
      "Create a context request from a submitted music company name. A name is not verified identity.",
    readOnly: false,
  },
  ingest_campaign_brief: {
    name: "import_music_campaign_brief",
    description: "Save a structured music campaign brief as context.",
    readOnly: false,
  },
  ingest_supporting_text: {
    name: "import_music_supporting_text",
    description:
      "Save specifically selected supporting music material as context. Supply only material the account asked to save, never conversation history.",
    readOnly: false,
  },
  ingest_release: {
    name: "import_music_release_context",
    description: "Create a context request from a Spotify release URL.",
    readOnly: false,
  },
  verify_release: {
    name: "verify_music_release",
    description: "Start provider verification for a saved release context request.",
    readOnly: false,
  },
  ingest: {
    name: "import_song_context",
    description:
      "Collect and save music context for a Spotify track URL and selected research topics.",
    readOnly: false,
  },
  read: {
    name: "read_music_context",
    description: "Read the status and results of a saved music context request.",
    readOnly: true,
  },
  brief: {
    name: "compile_music_context_brief",
    description:
      "Compile a creative direction or playlist pitch brief from saved music context without saving a snapshot.",
    readOnly: true,
  },
} satisfies Record<
  Action,
  { name: string; description: string; readOnly: boolean; delegated?: false }
>;
