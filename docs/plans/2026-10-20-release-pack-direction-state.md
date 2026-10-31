# Release Pack Direction State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Save a supplied visual world and reference manifest in the continuing pack, distinguish autonomous versus guided choices and block final production until the selected mode's direction requirements are met.

**Architecture:** Extend the optional brief JSON with creative_context, reusing existing revisioned persistence, owner checks and quote fingerprints. Resolve the selected world into actual production direction and explicit production-image inputs before quoting. Keep REST and native MCP on the same domain path; older clients without creative_context retain their current behavior.

**Tech Stack:** Next.js API, TypeScript, Zod, existing Supabase pack transaction, Vercel Workflows, Vitest, portable Markdown skill, maintained Marketing OpenAPI.

---

Parent: recoupable/app#2254. First vertical slice: recoupable/app#2264.

## Contract decisions

Optional creative_context contains:

- starting_point: established, rough_idea or none.
- working_mode: autonomous (default within this object) or guided.
- references: up to20 attributed HTTPS items with a stable local id, title, image/document/link media type, source kind and reference_only/production usage.
- directions: up to3 candidates with a stable local id, name, concept, palette, typography, optional supplied board URL and selected reference ids.
- selection: selected direction id, selected_by customer/agent and a short decision note.

Direction ids and reference ids are unique and selections must point to items in this same brief. A guided selection made by the agent does not satisfy customer review. Only selected production image references become generation image inputs. Reference-only imagery never enters those inputs. Existing legacy image references remain explicit production inputs. Combined production references cannot exceed the existing five-image limit.

The pack revision is the version of this entire creative state. Changing it uses expected_revision and invalidates the old quote through the existing transaction. No second identity model or migration is required for these JSON fields.

## Task1: Reproduce the missing behavior

**Files:** Create lib/content/packs/__tests__/packCreativeContext.test.ts; extend lib/content/packs/__tests__/packFirstUse.test.ts.

1. Test a guided proposed board cannot become ready or quote.
2. Test an agent selection still cannot approve a guided board.
3. Test a customer selection becomes ready and reaches production prompt/input fields.
4. Test autonomous direction selection proceeds without customer direction approval.
5. Test reference-only versus production image separation, duplicate/dangling ids and combined five-image limit.
6. Test direction/mode changes change the quote fingerprint and old legacy briefs normalize unchanged.
7. Run pnpm exec vitest run lib/content/packs/__tests__/packCreativeContext.test.ts and confirm the new missing schema/behavior fails.

## Task2: Add the optional schema and resolver

**Files:** Modify lib/content/packs/releasePackSchema.ts; create lib/content/packs/resolvePackCreativeContext.ts.

1. Add strict bounded schemas for the reference manifest, direction options and selection.
2. Validate uniqueness, selected direction/reference membership, media usage and image-count limits at the boundary.
3. Add one resolver that maps the selected direction's concept/palette/typography and explicitly selected production references into existing production inputs.
4. Keep unresolved creative_context drafts valid to save; readiness is a separate decision.

## Task3: Enforce selection in the continuing job

**Files:** Modify lib/content/packs/getPackBriefReadiness.ts and processPackOperation.ts; extend the behavioral tests above.

1. Include creative_direction_selection in missing readiness when a supplied creative_context has no eligible selection.
2. For guided mode, return a direction-review action; for autonomous mode instruct the agent to choose a direction rather than interview the customer again.
3. Preserve the canonical supplied brief after scoped Context reuse. Resolve the selected world when importing production sources and building prompts/media; never write a derived image-input list back as newly supplied references.
4. Block estimate and generation/retry before spending or dispatch if the direction remains unresolved.
5. Run the focused creative/first-use/brief/execution/transport/MCP checks once. Expand only for a concrete failure.

## Task4: Publish the additive maintained contract

**Owning repository:** Marketing.

**Files:** content/docs/source/api-reference/openapi/content.json; maintained release-packs guide; contract fixture/manifest artifacts identified by the existing contract check.

1. Add the same optional input shape to pack prepare/update brief schemas without changing required fields for older clients.
2. Explain saving a proposed board, customer versus agent selection and actual selected direction in production.
3. Refresh only the documented contract artifacts; run the scoped contract/docs checks and required production build.
4. Keep maintained contract and API frozen fixture source pins synchronized through the existing publication procedure.

## Task5: Update the single portable skill

**Owning repository:** Skills.

**Files:** skills/recoup-content-asset-pack/SKILL.md; canonical references/release-pack-brief.md and references/content-api.md plus registered vendored copies; local template/fixtures.

1. Teach minimal friendly intake, Recoup-first context reuse, three starting points and the two working modes.
2. Document actual discovered schema use. New fields are opt-in; older connections retain an honest local/conversation checkpoint and cannot be told a generated board exists.
3. Save supplied mood-board direction candidates and selections in creative_context when supported. Continue automatically in autonomous mode; guided selection must reflect customer feedback.
4. Explain automatic board generation, public reference collection and new asset recipes are separate capabilities until exposed.
5. Sync registered vendored copies and run the five required gates plus customer package tests/build. Do not invent a second plugin or authoring tree.

## Task6: Reviewable delivery

1. Run scoped format/lint and meaningful behavioral checks; let required CI run once.
2. Commit/push each owning repository's feature branch and open its PR against main.
3. Attach created PRs and update the work package with checks and exact implemented limits.
4. No paid generation, new mood boards or production migration is needed to verify this slice.
5. Record deployed/installed/host state separately. The existing subscriber bundle remains pinned until a coordinated reviewed release cutover; an automatically published skill ZIP does not prove store parity.

## Out of scope for this first slice

Automatic public/Recoup reference harvesting, generated mood boards, new model/provider routes, concept-generation budgets, missing asset recipes, batch concurrency and new customer bundle prices remain their linked work packages. Do not close those issues or advertise them as delivered by the state/selection foundation.
