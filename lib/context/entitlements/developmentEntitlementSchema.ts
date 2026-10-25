import { z } from "zod";
export const developmentEntitlementSchema = z.strictObject({
  kind: z.literal("entitlement_calculation"),
  method_version: z.literal("catalog-entitlements-v1"),
  organization_id: z.uuid().optional(),
  case_id: z.uuid(),
  expected_revision: z.number().int().positive(),
  assessment_id: z.string().min(1).max(256),
});
