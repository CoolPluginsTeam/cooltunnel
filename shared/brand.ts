import manifest from "../brand.config.json";
import type { BrandInfo } from "./types";

export const BRAND = manifest satisfies BrandInfo;

export function getBrandInfo(): BrandInfo {
  return JSON.parse(JSON.stringify(BRAND)) as BrandInfo;
}
