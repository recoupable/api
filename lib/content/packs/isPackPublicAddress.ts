import { isIP } from "node:net";
import { isSafeHttpUrl } from "@/lib/arweave/isSafeHttpUrl";
/** DNS answers must be globally routable; literal URL syntax checks alone are insufficient. */
export function isPackPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  if (family === 6)
    return /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(db8|0|10|20):/i.test(address);
  if (/^(192\.0\.|192\.0\.2\.|198\.(18|19|51)\.|203\.0\.113\.)/.test(address)) return false;
  return isSafeHttpUrl(`https://${address}/`);
}
