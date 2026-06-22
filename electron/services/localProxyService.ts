import http, { type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import https from "node:https";
import net from "node:net";
import type { ParsedLocalUrl } from "../../shared/types";
import type { LogService } from "./logService";

const MAX_REWRITE_BYTES = 5 * 1024 * 1024;
const PUBLIC_HOST_PATTERN = /^[a-z0-9-]+\.trycloudflare\.com$/i;
const TEXT_CONTENT_PATTERN = /^(?:text\/|application\/(?:json|javascript|x-javascript|xml|rss\+xml|atom\+xml|ld\+json|xhtml\+xml)|image\/svg\+xml)/i;

function stripPort(host: string): string {
  return host.trim().replace(/:\d+$/, "");
}

function publicHostFromRequest(request: IncomingMessage): string | null {
  const host = stripPort(String(request.headers.host ?? ""));
  return PUBLIC_HOST_PATTERN.test(host) ? host : null;
}

export function localOriginVariants(parsed: ParsedLocalUrl): string[] {
  const path = parsed.pathname;
  return [...new Set([
    `${parsed.protocol}://${parsed.hostHeader}${path}`,
    `${parsed.protocol}://${parsed.host}${path}`,
    `${parsed.protocol}://${parsed.hostHeader}`,
    `${parsed.protocol}://${parsed.host}`,
    `http://${parsed.hostHeader}`,
    `https://${parsed.hostHeader}`,
    `http://${parsed.host}`,
    `https://${parsed.host}`
  ])].sort((a, b) => b.length - a.length);
}

export function rewriteLocalUrl(value: string, parsed: ParsedLocalUrl, publicHost: string): string {
  const publicBase = `https://${publicHost}${parsed.pathname}`;
  const rewritten = localOriginVariants(parsed).reduce((result, origin) => {
    const replacements = [
      [origin, publicBase],
      [origin.replace(/\//g, "\\/"), publicBase.replace(/\//g, "\\/")],
      [encodeURIComponent(origin), encodeURIComponent(publicBase)],
      [encodeURIComponent(origin.replace(/\//g, "\\/")), encodeURIComponent(publicBase.replace(/\//g, "\\/"))],
      [origin.replace(/\//g, "&#47;"), publicBase.replace(/\//g, "&#47;")]
    ];
    return replacements.reduce(
      (next, [source, replacement]) =>
        next.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replacement),
      result
    );
  }, value);
  const escapedHost = publicHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return rewritten
    .replace(new RegExp(`https://${escapedHost}:\\d+(?=/)`, "gi"), `https://${publicHost}`)
    .replace(new RegExp(`https:\\\\\\/\\\\\\/${escapedHost}:\\d+(?=\\\\\\/)`, "gi"), `https:\\/\\/${publicHost}`)
    .replace(
      new RegExp(`https%3A%2F%2F${escapedHost}%3A\\d+(?=%2F)`, "gi"),
      encodeURIComponent(`https://${publicHost}`)
    )
    .replace(
      new RegExp(`https%3A%5C%2F%5C%2F${escapedHost}%3A\\d+(?=%5C%2F)`, "gi"),
      encodeURIComponent(`https:\\/\\/${publicHost}`)
    );
}

function rewriteCookies(value: string | string[] | undefined, parsed: ParsedLocalUrl): string[] | undefined {
  if (!value) return undefined;
  const cookies = Array.isArray(value) ? value : [value];
  const localHosts = [...new Set([parsed.host, stripPort(parsed.hostHeader)])]
    .map((host) => host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const domainPattern = new RegExp(`;\\s*Domain=\\.?(${localHosts.join("|")})(?=;|$)`, "gi");
  return cookies.map((cookie) => cookie.replace(domainPattern, ""));
}

function copyResponseHeaders(
  headers: IncomingHttpHeaders,
  parsed: ParsedLocalUrl,
  publicHost: string | null,
  rewritingBody: boolean
): IncomingHttpHeaders {
  const next = { ...headers };
  if (rewritingBody) {
    delete next["content-encoding"];
    delete next["content-length"];
    delete next.etag;
  }
  if (publicHost && typeof next.location === "string") {
    next.location = rewriteLocalUrl(next.location, parsed, publicHost);
  }
  const cookies = rewriteCookies(next["set-cookie"], parsed);
  if (cookies) next["set-cookie"] = cookies;
  return next;
}

export class LocalProxyService {
  private server: http.Server | null = null;
  private parsed: ParsedLocalUrl | null = null;
  private ignoreSsl = false;

  constructor(private readonly logs: LogService) {}

  async start(parsed: ParsedLocalUrl, ignoreSsl: boolean): Promise<string> {
    await this.stop();
    this.parsed = parsed;
    this.ignoreSsl = ignoreSsl;
    const server = http.createServer((request, response) => this.forward(request, response));
    server.keepAliveTimeout = 5_000;
    server.headersTimeout = 15_000;
    this.server = server;

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      await this.stop();
      throw new Error("Could not allocate a local proxy port.");
    }
    const url = `http://127.0.0.1:${address.port}`;
    this.logs.add("info", `Local routing proxy ready on ${url}.`);
    return url;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.parsed = null;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private forward(request: IncomingMessage, response: ServerResponse): void {
    const parsed = this.parsed;
    if (!parsed) {
      response.writeHead(503).end("Local routing proxy is not ready.");
      return;
    }

    const publicHost = publicHostFromRequest(request);
    const headers: IncomingHttpHeaders = {
      ...request.headers,
      host: parsed.hostHeader,
      "accept-encoding": "identity",
      "x-forwarded-proto": publicHost ? "https" : parsed.protocol,
      "x-forwarded-port": publicHost ? "443" : String(parsed.port),
      "x-cooltunnel-proxy": "1",
      "x-local-to-cloud-proxy": "1"
    };
    if (publicHost) headers["x-forwarded-host"] = publicHost;
    else delete headers["x-forwarded-host"];

    const transport = parsed.protocol === "https" ? https : http;
    const upstream = transport.request({
      protocol: `${parsed.protocol}:`,
      hostname: "127.0.0.1",
      port: parsed.port,
      method: request.method,
      path: request.url,
      headers,
      servername: net.isIP(stripPort(parsed.host)) ? undefined : stripPort(parsed.host),
      rejectUnauthorized: parsed.protocol === "https" ? !this.ignoreSsl : undefined
    }, (upstreamResponse) => {
      const contentType = String(upstreamResponse.headers["content-type"] ?? "");
      const canRewrite = Boolean(publicHost && TEXT_CONTENT_PATTERN.test(contentType));
      if (!canRewrite) {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          copyResponseHeaders(upstreamResponse.headers, parsed, publicHost, false)
        );
        upstreamResponse.pipe(response);
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let streaming = false;
      upstreamResponse.on("data", (chunk: Buffer) => {
        if (streaming) {
          response.write(chunk);
          return;
        }
        size += chunk.length;
        chunks.push(chunk);
        if (size > MAX_REWRITE_BYTES) {
          streaming = true;
          response.writeHead(
            upstreamResponse.statusCode ?? 502,
            copyResponseHeaders(upstreamResponse.headers, parsed, publicHost, false)
          );
          for (const buffered of chunks) response.write(buffered);
          chunks.length = 0;
        }
      });
      upstreamResponse.on("end", () => {
        if (streaming) {
          response.end();
          return;
        }
        const body = Buffer.concat(chunks).toString("utf8");
        const rewritten = rewriteLocalUrl(body, parsed, publicHost!);
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          copyResponseHeaders(upstreamResponse.headers, parsed, publicHost, true)
        );
        response.end(rewritten, "utf8");
      });
    });

    upstream.on("error", (error) => {
      this.logs.add("error", `Local proxy error: ${error.message}`);
      if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Could not reach the local site: ${error.message}`);
    });
    request.once("aborted", () => upstream.destroy());
    request.pipe(upstream);
  }
}
