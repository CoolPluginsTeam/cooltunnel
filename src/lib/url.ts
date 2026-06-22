export function siteHintFromLocalUrl(value: string): string | undefined {
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim()) ? value.trim() : `http://${value.trim()}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    const pathSegment = parsed.pathname.split("/").filter(Boolean)[0];
    if (pathSegment) return pathSegment;
    const normalizedHost = parsed.hostname.replace(/^\[|\]$/g, "");
    if (["localhost", "127.0.0.1", "::1"].includes(normalizedHost)) return undefined;
    return parsed.hostname.split(".")[0];
  } catch {
    return undefined;
  }
}
