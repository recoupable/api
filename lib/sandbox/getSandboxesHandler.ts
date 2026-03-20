import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSandboxesRequest } from "./validateGetSandboxesRequest";
import { selectAccountSandboxes } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { getSandboxStatus } from "./getSandboxStatus";
import { getRepoFileTree } from "@/lib/github/getRepoFileTree";
import type { SandboxCreatedResponse } from "./createSandbox";

/**
 * Handler for retrieving sandbox statuses for an account.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * For personal keys: Returns sandboxes for the key owner's account.
 * For org keys: Returns sandboxes for all accounts in the organization.
 *
 * Optional query parameters:
 * - sandbox_id: Filter to a specific sandbox (must belong to account/org)
 *
 * @param request - The request object.
 * @returns A NextResponse with array of sandbox statuses, plus snapshot_id and github_repo.
 */
export async function getSandboxesHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetSandboxesRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  // Determine account ID for snapshot lookup
  const snapshotAccountId =
    validated.accountIds?.length === 1 ? validated.accountIds[0] : validated.orgId;

  // Fetch sandbox records and snapshot info in parallel
  const [accountSandboxes, snapshots] = await Promise.all([
    selectAccountSandboxes(validated),
    snapshotAccountId ? selectAccountSnapshots(snapshotAccountId) : Promise.resolve([]),
  ]);

  // Extract snapshot info
  const snapshot_id = snapshots[0]?.snapshot_id ?? null;
  const github_repo = snapshots[0]?.github_repo ?? null;

  // Fetch live sandbox statuses and filetree in parallel
  const [statusResults, filetree] = await Promise.all([
    Promise.all(accountSandboxes.map(record => getSandboxStatus(record.sandbox_id))),
    github_repo ? getRepoFileTree(github_repo) : Promise.resolve(null),
  ]);

  // Filter out null results (sandboxes that no longer exist)
  const sandboxes = statusResults.filter(
    (status): status is SandboxCreatedResponse => status !== null,
  );

  return NextResponse.json(
    {
      status: "success",
      sandboxes,
      snapshot_id,
      github_repo,
      filetree,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
