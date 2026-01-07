# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

**Always commit and push changes after completing a task.** Follow these rules:

1. After making code changes, always commit with a descriptive message
2. Push commits to the current feature branch
3. **NEVER push directly to `main` or `test` branches** - always use feature branches and PRs
4. Before pushing, verify the current branch is not `main` or `test`
5. **Open PRs against the `test` branch**, not `main`

### Starting a New Task

When starting a new task, **first sync the `test` branch with `main`**:

```bash
git checkout test && git pull origin test && git fetch origin main && git merge origin/main && git push origin test
```

Then checkout main, pull latest, and create your feature branch from there.

This is the **only** time you should push directly to `test`.

## Build Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm test           # Run vitest
pnpm test:watch     # Watch mode
pnpm lint           # Fix lint issues
pnpm lint:check     # Check for lint issues
pnpm format         # Run prettier
pnpm format:check   # Check formatting
```

## Architecture

- **Next.js 16** API service with App Router
- **x402-next** middleware for crypto payments on Base network
- `app/api/` - API routes (image generation, artists, accounts, etc.)
- `lib/` - Business logic organized by domain:
  - `lib/ai/` - AI/LLM integrations
  - `lib/emails/` - Email handling (Resend)
  - `lib/supabase/` - Database operations
  - `lib/trigger/` - Trigger.dev task triggers
  - `lib/x402/` - Payment middleware utilities

## Key Patterns

- All API routes should have JSDoc comments
- Run `pnpm lint` before committing

## Constants (`lib/const.ts`)

All shared constants live in `lib/const.ts`:

- `INBOUND_EMAIL_DOMAIN` - `@mail.recoupable.com` (where emails are received)
- `OUTBOUND_EMAIL_DOMAIN` - `@recoupable.com` (where emails are sent from)
- `SUPABASE_STORAGE_BUCKET` - Storage bucket name
- Wallet addresses, model names, API keys
