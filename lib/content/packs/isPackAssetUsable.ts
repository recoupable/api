import type { PackAsset } from "./packTypes";
/** Usability requires a finished, inspected output and a nonblank caption. */
export function isPackAssetUsable(asset: PackAsset) {
  return (
    asset.status === "completed" &&
    asset.qa?.passed === true &&
    asset.files.length > 0 &&
    !!asset.caption?.trim()
  );
}
