# Delete a site

Authenticated `PATCH /api/sites/{id}` accepts:

```json
{"action":"delete","revision":3,"generationToken":"optional signed generation token"}
```

Use the latest site revision from GET. Authentication and workspace authorization are identical to editing. A stale revision returns 409; an inaccessible workspace returns 403. Success returns `{ "deleted": true, "id": "..." }`.

Deletion permanently removes the site's draft and published snapshot, plus site-owned signups, fan connections and activity via database foreign-key cascades. Public access then returns not found. Shared artist accounts, context evidence and uploaded media are not deleted.

When supplied, the signed generation token is validated against the authenticated account and site before cancelling its active workflow. Cancellation failure prevents deletion. Without a token, newly deployed workflows stop at their next existence checkpoint. Already-running provider calls may finish; revision-scoped updates cannot recreate a deleted row. Workflows started on older deployments require their signed token for prompt cancellation.

The equivalent MCP tool is `delete_site`. Require explicit customer authorization before invoking it.
