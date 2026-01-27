import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetPulsesRequest } from "./validateGetPulsesRequest";
import { selectPulseAccounts } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { selectAllPulseAccounts } from "@/lib/supabase/pulse_accounts/selectAllPulseAccounts";
import type { Tables } from "@/types/database.types";

type PulseRecord = Omit<Tables<"pulse_accounts">, "id"> & { id: string | null };

/**
 * Handler for retrieving pulse statuses for accounts.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * For personal keys: Returns array with single pulse for the account.
 * For org keys: Returns array of pulses for all accounts in the organization.
 * For Recoup admin key: Returns array of ALL pulse records.
 *
 * Optional query parameters:
 * - account_id: For org API keys, filter to a specific account within the organization
 * - active: Filter by active status (true/false). If undefined, returns all.
 *
 * @param request - The request object.
 * @returns A NextResponse with array of pulse account statuses.
 */
export async function getPulsesHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetPulsesRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { accountIds, active } = validated;

  // If accountIds is null, it means Recoup admin wants ALL records
  if (accountIds === null) {
    const allPulses = await selectAllPulseAccounts({ active });
    const pulses: PulseRecord[] = allPulses.map(p => ({
      id: p.id,
      account_id: p.account_id,
      active: p.active,
    }));

    return NextResponse.json(
      {
        status: "success",
        pulses,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  }

  // Query existing pulse records for specific accounts
  const existingPulses = await selectPulseAccounts({ accountIds, active });

  // Create a map of existing pulses by account_id
  const pulseMap = new Map(existingPulses.map(p => [p.account_id, p]));

  // Build the result array
  let pulses: PulseRecord[];

  if (active !== undefined) {
    // When filtering by active status, only return accounts that have matching pulse records
    pulses = existingPulses.map(p => ({
      id: p.id,
      account_id: p.account_id,
      active: p.active,
    }));
  } else {
    // When not filtering, include all accounts with defaults for those without pulse records
    pulses = accountIds.map(accountId => {
      const existing = pulseMap.get(accountId);
      if (existing) {
        return {
          id: existing.id,
          account_id: existing.account_id,
          active: existing.active,
        };
      }
      // Default pulse for accounts without a record
      return {
        id: null,
        account_id: accountId,
        active: false,
      };
    });
  }

  return NextResponse.json(
    {
      status: "success",
      pulses,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
