import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { parseLocalUrl } from "../../shared/tunnel";
import { LocalProxyService, rewriteLocalUrl } from "./localProxyService";
import type { LogService } from "./logService";

const servers: http.Server[] = [];
const proxies: LocalProxyService[] = [];

afterEach(async () => {
  await Promise.all(proxies.splice(0).map((proxy) => proxy.stop()));
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))
  ));
});

function fakeLogs(): LogService {
  return { add: () => undefined } as unknown as LogService;
}

async function listen(server: http.Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port.");
  return address.port;
}

async function request(proxyUrl: string, path = "/"): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return await new Promise((resolve, reject) => {
    const url = new URL(path, proxyUrl);
    const req = http.request(url, {
      headers: {
        host: "public-example.trycloudflare.com",
        "cf-ray": "abc123-TEST"
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.once("error", reject);
    req.end();
  });
}

describe("Local routing proxy", () => {
  it("preserves the public host separately while routing by the Local site domain", async () => {
    let receivedHeaders: http.IncomingHttpHeaders = {};
    const originPort = await listen(http.createServer((req, res) => {
      receivedHeaders = req.headers;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end('<a href="http://cool-plugins.local/page">Page</a>');
    }));
    const parsed = {
      ...parseLocalUrl("http://cool-plugins.local"),
      port: originPort,
      origin: `http://localhost:${originPort}`
    };
    const proxy = new LocalProxyService(fakeLogs());
    proxies.push(proxy);
    const proxyUrl = await proxy.start(parsed, false);
    const result = await request(proxyUrl);

    expect(receivedHeaders.host).toBe("cool-plugins.local");
    expect(receivedHeaders["x-forwarded-host"]).toBe("public-example.trycloudflare.com");
    expect(receivedHeaders["x-forwarded-proto"]).toBe("https");
    expect(receivedHeaders["x-local-to-cloud-proxy"]).toBe("1");
    expect(receivedHeaders["x-cooltunnel-proxy"]).toBe("1");
    expect(result.body).toContain("https://public-example.trycloudflare.com/page");
    expect(result.body).not.toContain("cool-plugins.local");
  });

  it("rewrites local redirect headers and removes local cookie domains", async () => {
    const originPort = await listen(http.createServer((_req, res) => {
      res.writeHead(302, {
        location: "http://cool-plugins.local/wp-admin/",
        "set-cookie": "wordpress_test=1; Domain=cool-plugins.local; Path=/"
      });
      res.end();
    }));
    const parsed = {
      ...parseLocalUrl("http://cool-plugins.local"),
      port: originPort,
      origin: `http://localhost:${originPort}`
    };
    const proxy = new LocalProxyService(fakeLogs());
    proxies.push(proxy);
    const result = await request(await proxy.start(parsed, false));

    expect(result.status).toBe(302);
    expect(result.headers.location).toBe("https://public-example.trycloudflare.com/wp-admin/");
    expect(result.headers["set-cookie"]?.[0]).not.toMatch(/Domain=/i);
  });

  it("rewrites subfolder origins without duplicating the public path", () => {
    const parsed = parseLocalUrl("localhost/sitename");
    expect(rewriteLocalUrl(
      "http://localhost/sitename/about",
      parsed,
      "public-example.trycloudflare.com"
    )).toBe("https://public-example.trycloudflare.com/sitename/about");
  });

  it("rewrites JSON-escaped and encoded local URLs used by WordPress and WooCommerce", () => {
    const parsed = parseLocalUrl("http://cool-plugins.local");
    const source = [
      "http:\\/\\/cool-plugins.local\\/wp-json",
      encodeURIComponent("https:\\/\\/cool-plugins.local\\/checkout")
    ].join(" ");
    const result = rewriteLocalUrl(source, parsed, "public-example.trycloudflare.com");
    expect(result).toContain("https:\\/\\/public-example.trycloudflare.com\\/wp-json");
    expect(decodeURIComponent(result)).toContain("https:\\/\\/public-example.trycloudflare.com\\/checkout");
    expect(result).not.toContain("cool-plugins.local");
  });

  it("removes Local's internal site port from rewritten public redirects", () => {
    const parsed = parseLocalUrl("http://cool-plugins.local");
    expect(rewriteLocalUrl(
      "http://cool-plugins.local:10004/wp-admin/",
      parsed,
      "public-example.trycloudflare.com"
    )).toBe("https://public-example.trycloudflare.com/wp-admin/");
  });
});
