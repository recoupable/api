# Brief access across asynchronous work

`brief`, `save_brief` and `read_brief` use the same domain operation through
HTTP and MCP. They authorize the actor at entry and recheck the same owner after
asynchronous evidence reads, before returning compiled or historical output.
`save_brief` also checks immediately before persistence and after the save returns.
A failed check withholds the result; a pre-save failure does not call the writer.

These are point-in-time membership checks, not a transaction lock. A revocation
while the save RPC is already running can withhold the response but cannot undo a
completed write. Atomic membership enforcement inside persistence remains a
separate database concern. Existing source withdrawal and immutable snapshot
behavior remain owned by the database RPCs.

The regression fixtures run the real shared operation through the HTTP handler
and registered MCP callback, with synthetic identity and in-memory persistence.
They cover mid-read revocation, pre-save rejection, post-save withholding, changed
owner rejection, and exact HTTP-save/MCP-read output comparison. They do not prove
live authentication, database transaction behavior, deployed state, native-browser
acceptance, or intended-account parity.

Related work: recoupable/app#2116 and recoupable/app#2120. The canonical customer
case and live acceptance receipts remain in their private owning records.
