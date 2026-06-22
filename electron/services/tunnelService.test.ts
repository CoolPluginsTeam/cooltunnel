import { describe, expect, it } from "vitest";
import {
  appendPublicPath,
  buildProxyTunnelArgs,
  buildTunnelArgs,
  parseLocalUrl,
  PUBLIC_URL_PATTERN
} from "../../shared/tunnel";

describe("local URL parsing and command arguments", () => {
  it("builds the required HTTPS command arguments", () => {
    const parsed = parseLocalUrl("https://plugins.test");
    expect(parsed).toMatchObject({
      protocol: "https",
      host: "plugins.test",
      port: 443,
      origin: "https://localhost:443",
      hostHeader: "plugins.test",
      pathname: "",
      ignoreSsl: true
    });
    expect(buildTunnelArgs(parsed, true)).toEqual([
      "tunnel",
      "--url",
      "https://localhost:443",
      "--http-host-header",
      "plugins.test",
      "--no-tls-verify"
    ]);
  });

  it("builds the required HTTP command arguments", () => {
    const parsed = parseLocalUrl("http://plugins.test");
    expect(buildTunnelArgs(parsed, false)).toEqual([
      "tunnel",
      "--url",
      "http://localhost:80",
      "--http-host-header",
      "plugins.test"
    ]);
  });

  it("preserves a custom port", () => {
    const parsed = parseLocalUrl("http://plugins.test:8080");
    expect(parsed.port).toBe(8080);
    expect(parsed.origin).toBe("http://localhost:8080");
    expect(buildTunnelArgs(parsed, false)).toEqual([
      "tunnel",
      "--url",
      "http://localhost:8080",
      "--http-host-header",
      "plugins.test"
    ]);
  });

  it("accepts protocol-less localhost subfolder URLs", () => {
    const parsed = parseLocalUrl("localhost/sitename");
    expect(parsed).toMatchObject({
      originalUrl: "http://localhost/sitename",
      protocol: "http",
      host: "localhost",
      port: 80,
      origin: "http://localhost:80",
      hostHeader: "localhost",
      pathname: "/sitename"
    });
    expect(buildTunnelArgs(parsed, false)).toEqual([
      "tunnel",
      "--url",
      "http://localhost:80",
      "--http-host-header",
      "localhost"
    ]);
  });

  it("normalizes trailing slashes and accepts a localhost port", () => {
    expect(parseLocalUrl("http://localhost/sitename/").pathname).toBe("/sitename");
    expect(parseLocalUrl("localhost:50043")).toMatchObject({
      origin: "http://localhost:50043",
      hostHeader: "localhost:50043",
      routerMode: "localhost",
      pathname: ""
    });
  });

  it("supports explicit Local router modes", () => {
    expect(parseLocalUrl("demo.local", "site-domain")).toMatchObject({
      hostHeader: "demo.local",
      routerMode: "site-domain"
    });
    expect(parseLocalUrl("localhost:10005", "localhost")).toMatchObject({
      hostHeader: "localhost:10005",
      routerMode: "localhost"
    });
  });

  it("accepts IPv4 and IPv6 loopback URLs", () => {
    expect(parseLocalUrl("127.0.0.1:8080")).toMatchObject({
      host: "127.0.0.1",
      origin: "http://localhost:8080"
    });
    expect(parseLocalUrl("[::1]:8080")).toMatchObject({
      host: "[::1]",
      origin: "http://localhost:8080"
    });
  });

  it("appends the local path to a public URL exactly once", () => {
    expect(appendPublicPath("https://abc.trycloudflare.com", "/sitename/"))
      .toBe("https://abc.trycloudflare.com/sitename");
    expect(appendPublicPath("https://abc.trycloudflare.com/", ""))
      .toBe("https://abc.trycloudflare.com");
  });

  it("rejects unsupported and malformed URLs", () => {
    expect(() => parseLocalUrl("ftp://plugins.test")).toThrow(/Only http and https/);
    expect(() => parseLocalUrl("not a url")).toThrow(/valid URL/);
    expect(() => parseLocalUrl("https://user:pass@plugins.test")).toThrow(/no credentials/);
  });

  it("detects a public URL in cloudflared output", () => {
    const stderr = "INF Your quick Tunnel has been created! Visit it at https://abc-random.trycloudflare.com";
    expect(stderr.match(PUBLIC_URL_PATTERN)?.[0]).toBe("https://abc-random.trycloudflare.com");
  });

  it("routes Quick Tunnels through the private loopback proxy", () => {
    expect(buildProxyTunnelArgs("http://127.0.0.1:43210")).toEqual([
      "tunnel",
      "--url",
      "http://127.0.0.1:43210"
    ]);
  });
});
