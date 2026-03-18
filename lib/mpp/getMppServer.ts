import { Mppx, tempo } from "mppx/server";
import { SMART_ACCOUNT_ADDRESS } from "@/lib/const";

/**
 * Creates and returns an mppx server instance configured for Tempo payments.
 * Uses USDC on the Tempo mainnet chain, paid to the Recoup smart account.
 *
 * @returns The configured Mppx server instance.
 */
export function getMppServer() {
  return Mppx.create({
    methods: [
      tempo({
        recipient: SMART_ACCOUNT_ADDRESS,
      }),
    ],
    secretKey: process.env.MPP_SECRET_KEY,
  });
}
