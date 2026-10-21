# Reviewer guidance from existing API #258

Existing owner: [Mono #358](https://github.com/recoupable/mono/issues/358).
Original PR: [API #258](https://github.com/recoupable/api/pull/258), exact head
`b10017e782367c9342c91e37796af6140287b70f`, still targeting retired `test` at inspection.
Current-main baseline: `5a070968c4f1ee4c85486e1158f5cb39ef0a8b9f`.

The original description calls the change documentation-only, but its current
GitHub comparison includes 29 files. This successor selects only its contributor
instruction intent. The other runtime/content files remain outside this slice;
the original PR is not retargeted, merged or closed here.

## Compared intent

| Original instruction intent | Current-main finding and bounded successor |
| --- | --- |
| Concrete reviewer and pre-push SRP/DRY checks | Current `AGENTS.md` states the principles but lacks the explicit review checklist. One canonical checklist now applies those existing principles to changed features and consumers. |
| Purpose-named files, re-export barrels and shared transforms | The checklist preserves one exported function per file and checks for domain logic in re-export barrels. Existing MCP registration `index.ts` entry points retain their documented registration role. Repeated transforms reuse or extract a shared helper. |
| Shared API/MCP schemas and equivalent capability validation | The existing guide shares business functions but does not explicitly check schema reuse, required fields, exclusions, defaults and limits. The checklist adds those checks after intentional input adaptation, preserving transport/authentication differences and grant-specific tool availability. |
| Consistent `resolveAccountId()` MCP example | Already present at the inspected current-main baseline, including its import, resolver call and error handling. The current example and organization context are preserved. |

The checklist consolidates review/pre-push guidance in the existing Code
Principles section. Existing commit, CI, merge-approval and authentication rules
are preserved. It adds no route, tool, runtime validator, storage or public API
contract and does not require exposing every REST operation through MCP.

## Verification scope

Check the two-file documentation diff with `git diff --check` and the existing
`pnpm lint` command before committing. Independent review and current-head CI
belong to this successor PR. No new unit cases are needed for unchanged runtime
behavior. Existing API/MCP schema fixtures and the Marketing/retained Docs source
pins remain unchanged.

This instruction correction is not acceptance of the original PR's other files,
the full retired-PR inventory, a hosted/customer workflow, provider execution or
the separate #334/#351 broader follow-ups. Their existing owners and holds remain.
