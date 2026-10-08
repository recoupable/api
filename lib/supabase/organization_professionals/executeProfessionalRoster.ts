import supabase from "@/lib/supabase/serverClient";
import type { ConfirmProfessionalInput, ListProfessionalsInput } from "@/lib/professionals/schema";
import { ProfessionalRosterError } from "@/lib/professionals/ProfessionalRosterError";

/** Both transports use these atomic, membership-checked database operations. */
export async function executeProfessionalRoster(
  actor: string,
  input: ConfirmProfessionalInput | ListProfessionalsInput,
) {
  const response =
    "idempotency_key" in input
      ? await supabase.rpc("confirm_professional_roster", {
          p_actor: actor,
          p_org: input.organization_id,
          p_key: input.idempotency_key,
          p_input: input,
        })
      : await supabase.rpc("list_professional_roster", {
          p_actor: actor,
          p_org: input.organization_id,
          p_after: input.after ?? undefined,
        });
  if (response.error) {
    const code = response.error.code;
    if (code === "42501")
      throw new ProfessionalRosterError(
        "Access denied to this organization or professional record",
        403,
      );
    if (code === "23505")
      throw new ProfessionalRosterError("This request key was used for different input", 409);
    if (code === "22023" || code === "22P02")
      throw new ProfessionalRosterError("Invalid professional roster request", 400);
    throw new ProfessionalRosterError(
      "idempotency_key" in input
        ? "Could not access the professional roster. Retry with the same request key."
        : "Could not load the professional roster. Retry this page.",
      503,
    );
  }
  return response.data;
}
