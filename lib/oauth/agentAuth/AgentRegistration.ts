import { z } from "zod";

export const agentRegistrationSchema = z.object({
  id: z.string().regex(/^reg_[A-Za-z0-9_-]{43}$/),
  claimHash: z.string().regex(/^[a-f0-9]{64}$/),
  attemptHash: z.string().regex(/^[a-f0-9]{64}$/),
  codeHash: z.string().regex(/^[a-f0-9]{64}$/),
  email: z.string().email(),
  createdAt: z.number().int(),
  claimExpiresAt: z.number().int(),
  status: z.enum(["pending", "approving", "approved", "denied"]),
  failedAttempts: z.number().int().min(0).max(5),
  lastPollAt: z.number().int().nullable(),
  pollInterval: z.number().int().min(5).max(60),
  accountId: z.string().uuid().optional(),
  subject: z.string().startsWith("did:privy:").optional(),
  accessExpiresAt: z.number().int().optional(),
});
export type AgentRegistration = z.infer<typeof agentRegistrationSchema>;
export type AgentClaimIdentity = {
  accountId: string;
  subject: string;
  verifiedEmails: string[];
};
