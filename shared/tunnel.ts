import type { ParsedLocalUrl, RouterMode } from "./types";

export const PUBLIC_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "";
  const normalized = `/${pathname.split("/").filter(Boolean).join("/")}`;
  return normalized === "/" ? "" : normalized;
}

export function appendPublicPath(publicUrl: string, pathname: string): string {
  const path = normalizePathname(pathname);
  return `${publicUrl.replace(/\/+$/, "")}${path}`;
}

export function parseLocalUrl(input: string, preferredRouterMode: RouterMode = "auto"): ParsedLocalUrl {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a local site URL.");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Enter a valid URL, for example https://plugins.test.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https local URLs are allowed.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error("The local URL must contain a valid host and no credentials.");
  }

  const protocol = parsed.protocol.slice(0, -1) as "http" | "https";
  const port = parsed.port ? Number(parsed.port) : protocol === "https" ? 443 : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The URL contains an invalid port.");
  }

  const normalizedHost = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const isLoopback = normalizedHost === "localhost" || normalizedHost === "127.0.0.1" || normalizedHost === "::1";
  const routerMode = preferredRouterMode === "auto"
    ? (isLoopback ? "localhost" : "site-domain")
    : preferredRouterMode;
  const hostHeader = routerMode === "localhost" && parsed.port
    ? `${parsed.hostname}:${port}`
    : parsed.hostname;

  return {
    originalUrl: parsed.toString(),
    protocol,
    host: parsed.hostname,
    port,
    origin: `${protocol}://localhost:${port}`,
    hostHeader,
    pathname: normalizePathname(parsed.pathname),
    ignoreSsl: protocol === "https",
    routerMode
  };
}

export function buildTunnelArgs(parsed: ParsedLocalUrl, ignoreSsl: boolean): string[] {
  const args = [
    "tunnel",
    "--url",
    parsed.origin,
    "--http-host-header",
    parsed.hostHeader
  ];
  if (ignoreSsl && parsed.protocol === "https") args.push("--no-tls-verify");
  return args;
}

export function buildProxyTunnelArgs(proxyUrl: string): string[] {
  return ["tunnel", "--url", proxyUrl];
}
