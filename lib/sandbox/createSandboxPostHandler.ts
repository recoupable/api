import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSandbox } from "@/lib/sandbox/createSandbox";
import { validateSandboxBody } from "@/lib/sandbox/validateSandboxBody";
import { insertAccountSandbox } from "@/lib/supabase/account_sandboxes/insertAccountSandbox";
import { triggerRunSandboxCommand } from "@/lib/trigger/triggerRunSandboxCommand";

/**
 * Handler for POST /api/sandboxes.
 *
 * Creates a Vercel Sandbox and triggers the run-sandbox-command task to execute the prompt.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 * Saves sandbox info to the account_sandboxes table.
 *
 * @param request - The request object
 * @returns A NextResponse with sandbox creation result or error
 */
export async function createSandboxPostHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSandboxBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const result = await createSandbox();

    await insertAccountSandbox({
      account_id: validated.accountId,
      sandbox_id: result.sandboxId,
    });

    await triggerRunSandboxCommand({
      prompt: validated.prompt,
      sandboxId: result.sandboxId,
    });

    return NextResponse.json(
      { status: "success", sandboxes: [result] },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create sandbox";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 400, headers: getCorsHeaders() },
    );
  }
}
