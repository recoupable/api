# Guarded Git file updates

Owning work: app #2116 / #2140, Context checkpoint D. This adds an opt-in condition to the existing authenticated Git-backed file routes. It does not change the live sandbox filesystem writer or create accepted Context facts.

## Read, edit, save

1. `GET /api/sandboxes/file?path=drafts/notes.txt&include_revision=true` returns `{ status: "success", content, sha }`. Files with recognized binary extensions also return `encoding: "base64"`. The content and SHA come from the same GitHub Contents response on `main`; no separate latest-content fetch is used.
2. Retain that SHA with the draft. Send the usual uploaded-blob URL to `POST /api/sandboxes/files`, adding `expected_sha` to the corresponding file:

   ```json
   {
     "path": "drafts",
     "files": [{ "name": "notes.txt", "url": "https://example.test/uploaded-blob", "expected_sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }]
   }
   ```

3. A guarded update passes the exact condition to GitHub's atomic Contents update on `main`. It never fetches/replaces the condition or automatically retries a conflict. Successful entries in `uploaded` return the resulting blob `sha`.
4. If every upload fails with a GitHub 409 conflict, HTTP 409 returns `{ status: "error", error, conflicts: ["notes.txt"] }`. All-failed batches with mixed conflict/other failures retain HTTP 500 and include both errors and conflicts. For partial success, existing HTTP 200 is retained with `uploaded`, `errors` and `conflicts`. Inspect every entry; this batch is not a transaction. Keep the local draft, read the latest content and reconcile explicitly before uploading again. Existing temporary-blob deletion still happens after every attempt, including conflicts; a retry needs a new upload URL.

Authentication and existing account snapshot/submodule resolution run before GitHub file access. The client cannot select an arbitrary repository or branch through these fields. Read and write conditions must refer to the same logical account/path and resolved repository. Repository authorization/submodule policy remains an independent existing boundary; this change is not an authorization redesign.

## Compatibility and limits

- Omit `include_revision` to retain the existing raw-file read. Omit `expected_sha` to retain legacy create/update behavior on the repository default branch, including its latest-SHA lookup. Both guarded and legacy paths now reject dot/traversal/backslash/control segments, malformed Unicode, and leading/trailing/doubled slashes (empty segments) with HTTP 400. This is an intentional validation tightening: legacy callers must supply canonical relative paths instead of relying on provider normalization. Empty top-level upload directory remains valid; filenames must be nonempty. Legacy writes remain unguarded and must not be counted as D acceptance.
- Version-aware clients must always include their observed condition for updates. No current UI/worker is silently migrated by adding this API option. A required-condition rollout would be a separate compatibility change.
- Guarded reads and writes use `main`, matching the existing raw-file read and submodule discovery branch. No arbitrary ref, default-branch inference, create-if-absent condition or new-file token is introduced. A missing `main`/file is an error, not a fallback to a different branch or legacy write.
- Conditions are 40-character lowercase Git blob SHAs, representing content equality, not a monotonically increasing edit counter. Identical bytes can legitimately have the same SHA. This does not detect an edit/revert history or a file moved away and restored with identical content.
- Versioned reads support regular files whose content GitHub includes inline as base64 (normally up to 1 MB). Unknown binary files that are not valid UTF-8 are rejected rather than decoded with replacement characters. Missing/unsupported content, directories and symlink responses are rejected rather than pairing a SHA with separately fetched bytes. Legacy binary/raw reads remain available for larger files.
- Only upstream 409 is classified as a conflict; missing access, validation errors and unavailable providers are not relabeled as successful writes. The returned revision is a blob SHA, not an ETag, source-version ID or accepted Context document version.
- A Git commit does not synchronize already running sandbox files, publish accepted facts, change rights, or update financial records. Existing uncontrolled writers can still overwrite content later. This feature protects the guarded commit attempt itself.

## Sandbox decision remains open

The sandbox `editFileTool` reads a file, computes replacement text and calls `Sandbox.writeFile`. `VercelSandbox.writeFile` delegates to the SDK's unconditional `writeFiles`. Records' existing stale-edit counterexample still fails on this branch: a newer completed write is lost when the paused edit resumes. Its uncontended control passes. This PR does not claim full checkpoint D closure.

A safe sandbox design must specify all of the following before implementation:

- The supported reader condition (for example, a content digest with defined missing-file semantics), and the returned success/conflict shape. Git SHA need not be the filesystem token.
- A comparison and replacement mechanism atomic with respect to every relevant writer, including agent tools, bash processes, editors, concurrent requests and separate app workers. Atomic rename alone ensures a complete file but does not validate the prior revision. A second read followed by write leaves the original race.
- Which writers must participate and how bypassing the guarded operation is handled. An in-memory mutex in one API instance does not coordinate sandbox processes; a lock file protects only writers that honor it. Do not promise universal stale-write protection while unrestricted shell/SDK writes can bypass the protocol.
- Lock/lease scope, crash recovery, symlink/path replacement behavior, file creation, large/binary data and timeout semantics if coordination is selected. Alternatively, choose a backend with a native conditional operation; a storage replacement is not assumed here.
- Explicit adoption in `editFileTool`/`writeFileTool` and other clients, with tests that exercise two independent writers at the atomic boundary. Do not remove or weaken Records' failing regression simply to make this Git-only PR appear complete.

Draft-origin provenance is also separate: supporting-text ingestion records submitted text/actor/source hashes, but does not currently claim a draft's original file path/revision or link it to a business subject. Do not invent those fields or treat saving a draft as accepting company facts.

## Verification and release

Synthetic route tests use actual validators, handlers and Git helpers with mocked authentication lookup, snapshot/submodule resolver, blob deletion and GitHub HTTP. Two readers, first save/new SHA, stale conflict/preserved content, exact-condition forwarding, no update-time GET, denied auth, invalid fields and legacy behavior are checked. This is not a live GitHub write or production authorization test. GitHub's Contents API contract supplies the atomic SHA update; see https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents.

The existing Records stale sandbox fixture is retained in the private owning receipt and was temporarily executed unchanged against this branch (one passing control, one expected stale-overwrite failure). No failing acceptance fixture is added to the ordinary product suite.

Before public release, the canonical Marketing OpenAPI docs and pinned Docs copy must adopt `include_revision`, `sha`, `files[].expected_sha`, partial conflict behavior and the 409 response against the approved API revision. This in-repository guide and route JSDoc are the implementation contract for review, not a claim that published docs already expose the new option. Hosted acceptance requires an explicitly authorized isolated repository/account and normal authentication; no hosted write, merge or manual deployment is part of this PR.
