# Professional roster account identity

`GET` and `POST /api/organizations/professionals` return `professional.artist_id`
(or `professionals[].artist_id` on lists), a required UUID referencing `accounts.id`.
The existing `id` remains the stable professional-record ID used for role updates.
Use `artist_id` for artist workflows and account-linked resources. The request
contract is unchanged: `mode: new` creates an artist account and roster membership;
`mode: existing` reuses the selected professional's account and adds roles.

The database migration `20261023160000_professional_artist_accounts.sql` must be
applied before this API release. Account/profile creation, organization membership,
roles and idempotency receipts commit together. Retry the same request key after
an uncertain response. Requests saved before the migration retain their original
outcome and gain the linked artist ID.

Authentication, organization access checks and explicit roster intent are unchanged.
Roles alone do not assign catalog credits or royalty rights. No provider lookup,
enrichment, account-name merge or creator_id rename is introduced.
