# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

**Always commit and push changes after completing a task.** Follow these rules:

1. After making code changes, always commit with a descriptive message
2. Push commits to the current feature branch
3. **NEVER push directly to `main` or `test` branches** - always use feature branches and PRs
4. Before pushing, verify the current branch is not `main` or `test`

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

- Use constants from `lib/consts.ts` and `lib/const.ts`
- Email domains: inbound at `@mail.recoupable.com`, outbound from `@recoupable.com`
- All API routes should have JSDoc comments
- Run `pnpm lint` before committing
