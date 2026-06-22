import type { SiteProfile } from "./types";
import { parseLocalUrl } from "./tunnel";

export function legacyUrlToProfile(localUrl: string): Omit<SiteProfile, "id" | "createdAt" | "updatedAt"> {
  const parsed = parseLocalUrl(localUrl);
  return {
    name: parsed.host === "localhost" ? "My Local Site" : parsed.host,
    localUrl: parsed.originalUrl,
    wordpressPath: "",
    sourceType: "unknown",
    routerMode: "auto",
    ignoreSsl: parsed.ignoreSsl,
    publicPath: parsed.pathname,
    fixHtaccess: false,
    keepWordPressFix: true,
    favorite: true
  };
}
