import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpdatePulsesRequest } from "./validateUpdatePulsesRequest";
import { upsertPulseAccount } from "@/lib/supabase/pulse_accounts/upsertPulseAccount";
import { selectPulseAccounts } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { selectAllPulseAccounts } from "@/lib/supabase/pulse_accounts/selectAllPulseAccounts";

interface PulseRecord {
  id: string | null;
  account_id: string;
  active: boolean;
}

/**
 * Handler for updating pulse status for an account.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Creates a new pulse_accounts record if one doesn't exist,
 * otherwise updates the existing record (upsert).
 *
 * Returns an array of pulses for consistency with the GET endpoint:
 * - For personal keys: Returns array with single pulse
 * - For org keys: Returns array of pulses for all accounts in the organization
 * - For Recoup admin key: Returns array of ALL pulse records
 *
 * @param request - The request object.
 * @returns A NextResponse with array of pulse account statuses.
 */
export async function updatePulsesHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateUpdatePulsesRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { accountId, active, responseAccountIds } = validated;

  // Update the pulse account
  const updatedPulse = await upsertPulseAccount({ account_id: accountId, active });

  if (!updatedPulse) {
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to update pulse status",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }

  // Build the response array
  let pulses: PulseRecord[];

  if (responseAccountIds === null) {
    // Recoup admin key: Return ALL pulse records
    const allPulses = await selectAllPulseAccounts({});
    pulses = allPulses.map(p => ({
      id: p.id,
      account_id: p.account_id,
      active: p.active,
    }));
  } else {
    // Query existing pulse records for the response accounts
    const existingPulses = await selectPulseAccounts({ accountIds: responseAccountIds });
    const pulseMap = new Map(existingPulses.map(p => [p.account_id, p]));

    // Build response with defaults for accounts without records
    pulses = responseAccountIds.map(accId => {
      const existing = pulseMap.get(accId);
      if (existing) {
        return {
          id: existing.id,
          account_id: existing.account_id,
          active: existing.active,
        };
      }
      return {
        id: null,
        account_id: accId,
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
