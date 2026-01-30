import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const sandboxBodySchema = z.object({
  script: z.string({ message: "script is required" }).min(1, "script cannot be empty"),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(5 * 60 * 60 * 1000)
    .optional()
    .default(5 * 60 * 1000)
    .describe("Timeout in milliseconds. Default: 5 minutes. Max: 5 hours for Pro/Enterprise."),
  runtime: z
    .enum(["node22", "node20", "node18"])
    .optional()
    .default("node22")
    .describe("Node.js runtime version"),
  vcpus: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .default(4)
    .describe("Number of vCPUs to allocate (1-8)"),
});

export type SandboxBody = z.infer<typeof sandboxBodySchema>;

/**
 * Validates request body for POST /api/sandbox.
 *
 * @param body - The request body
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateSandboxBody(body: unknown): NextResponse | SandboxBody {
  const result = sandboxBodySchema.safeParse(body);

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
