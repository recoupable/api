import { USDC_ADDRESS } from "@/lib/const";
import type { Address } from "viem";
import { encodeFunctionData, parseUnits } from "viem";
import { erc20Abi } from "viem";
import { Call } from "@/lib/coinbase/sendUserOpAndWait";

/**
 * Creates transfer calls for sending USDC to a recipient address.
 *
 * @param recipientAddress - The address to send USDC to.
 * @param amount - The amount to send in USDC.
 * @returns Array of calls for the user operation.
 */
export function getTransferCalls(recipientAddress: Address, amount: string): readonly Call[] {
  const transferData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipientAddress, parseUnits(amount, 6)], // USDC has 6 decimals
  });

  return [
    {
      to: USDC_ADDRESS,
      data: transferData,
    },
  ] as Call[];
}
