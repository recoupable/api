# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

**Always commit and push changes after completing a task.** Follow these rules:

1. After making code changes, always commit with a descriptive message
2. Push commits to the current feature branch
3. **NEVER push directly to `main` or `test` branches** - always use feature branches and PRs
4. Before pushing, verify the current branch is not `main` or `test`
5. **Open PRs against the `test` branch**, not `main`
6. After pushing, check if a PR exists for the branch. If not, create one with `gh pr create --base test`

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

## Code Principles

- **SRP (Single Responsibility Principle)**: One exported function per file. Each file should do one thing well.
- **DRY (Don't Repeat Yourself)**: Extract shared logic into reusable utilities.
- **KISS (Keep It Simple)**: Prefer simple solutions over clever ones.
- All API routes should have JSDoc comments
- Run `pnpm lint` before committing

## Input Validation

All API endpoints should use a **validate function** for input parsing. Use Zod for schema validation.

### Pattern

Create a `validate<EndpointName>Body.ts` or `validate<EndpointName>Query.ts` file:

```typescript
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

// Define the schema
export const createExampleBodySchema = z.object({
  name: z.string({ message: "name is required" }).min(1, "name cannot be empty"),
  id: z.string().uuid("id must be a valid UUID").optional(),
});

// Export the inferred type
export type CreateExampleBody = z.infer<typeof createExampleBodySchema>;

/**
 * Validates request body for POST /api/example.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCreateExampleBody(body: unknown): NextResponse | CreateExampleBody {
  const result = createExampleBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}
```

### Usage in Handler

```typescript
const validated = validateCreateExampleBody(body);
if (validated instanceof NextResponse) {
  return validated;
}
// validated is now typed as CreateExampleBody
```

### Naming Convention

- `validate<Name>Body.ts` - For POST/PUT request bodies
- `validate<Name>Query.ts` - For GET query parameters

## Constants (`lib/const.ts`)

All shared constants live in `lib/const.ts`:

- `INBOUND_EMAIL_DOMAIN` - `@mail.recoupable.com` (where emails are received)
- `OUTBOUND_EMAIL_DOMAIN` - `@recoupable.com` (where emails are sent from)
- `SUPABASE_STORAGE_BUCKET` - Storage bucket name
- Wallet addresses, model names, API keys
