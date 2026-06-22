import { app, BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  AppSettings,
  TunnelStartOptions,
  TunnelState
} from "../../shared/types";
import { appendPublicPath, buildProxyTunnelArgs, parseLocalUrl, PUBLIC_URL_PATTERN } from "../../shared/tunnel";
import type { LogService } from "./logService";
import { LocalProxyService } from "./localProxyService";

function quoteDisplay(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

export class TunnelService {
  private process: ChildProcess | null = null;
  private readonly proxy: LocalProxyService;
  private state: TunnelState = {
    status: "idle",
    publicUrl: null,
    error: null,
    command: null
  };

  constructor(private readonly logs: LogService) {
    this.proxy = new LocalProxyService(logs);
  }

  getState(): TunnelState {
    return { ...this.state };
  }

  async start(options: TunnelStartOptions, settings: AppSettings): Promise<TunnelState> {
    if (this.process && !this.process.killed) {
      throw new Error("A tunnel is already running. Stop it before starting another.");
    }

    const parsed = parseLocalUrl(options.localUrl, options.routerMode);
    const binary = this.resolveBinary(settings.cloudflaredPath);
    const proxyUrl = await this.proxy.start(parsed, options.ignoreSsl);
    const args = buildProxyTunnelArgs(proxyUrl);
    const displayBinary = binary === "cloudflared" ? binary : path.basename(binary);
    const command = [displayBinary, ...args].map(quoteDisplay).join(" ");

    this.setState({ status: "starting", publicUrl: null, error: null, command });
    this.logs.add("info", `Starting: ${command}`);

    return await new Promise<TunnelState>((resolve, reject) => {
      let settled = false;
      const child = spawn(binary, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      this.process = child;

      const handleOutput = (chunk: Buffer, level: "output" | "error") => {
        const text = chunk.toString("utf8");
        for (const line of text.split(/\r?\n/).filter(Boolean)) this.logs.add(level, line);
        const match = text.match(PUBLIC_URL_PATTERN);
        const publicUrl = match ? appendPublicPath(match[0], parsed.pathname) : null;
        if (publicUrl && this.state.publicUrl !== publicUrl) {
          this.setState({ ...this.state, status: "active", publicUrl, error: null });
          this.logs.add("success", `Public URL ready: ${publicUrl}`);
          if (!settled) {
            settled = true;
            resolve(this.getState());
          }
        }
      };

      child.stdout?.on("data", (chunk: Buffer) => handleOutput(chunk, "output"));
      child.stderr?.on("data", (chunk: Buffer) => handleOutput(chunk, "output"));
      child.on("error", (error: NodeJS.ErrnoException) => {
        this.process = null;
        void this.proxy.stop();
        const message = error.code === "ENOENT"
          ? "cloudflared was not found. Add cloudflared.exe inside resources/bin, select it in Settings, or install cloudflared on your system."
          : `Could not start cloudflared: ${error.message}`;
        this.setState({ ...this.state, status: "error", error: message });
        this.logs.add("error", message);
        if (!settled) {
          settled = true;
          reject(new Error(message));
        }
      });
      child.on("exit", (code, signal) => {
        this.process = null;
        void this.proxy.stop();
        const wasStopping = this.state.status === "stopped";
        if (!wasStopping) {
          const message = this.state.publicUrl
            ? `Tunnel closed${signal ? ` (${signal})` : ""}.`
            : `cloudflared exited before a public URL was created (code ${code ?? "unknown"}).`;
          this.setState({
            ...this.state,
            status: this.state.publicUrl ? "stopped" : "error",
            error: this.state.publicUrl ? null : message
          });
          this.logs.add(this.state.publicUrl ? "info" : "error", message);
        }
        if (!settled) {
          settled = true;
          reject(new Error(this.state.error ?? "cloudflared exited unexpectedly."));
        }
      });

      setTimeout(() => {
        if (!settled && this.process === child) {
          settled = true;
          resolve(this.getState());
        }
      }, 1500);
    });
  }

  async stop(): Promise<TunnelState> {
    const child = this.process;
    this.setState({ ...this.state, status: "stopped", error: null });
    if (!child || child.killed) {
      await this.proxy.stop();
      this.logs.add("info", "Tunnel is stopped.");
      return this.getState();
    }

    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      child.once("exit", finish);
      if (process.platform === "win32" && child.pid) {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore"
        });
        killer.once("exit", () => setTimeout(resolve, 100));
        killer.once("error", () => {
          child.kill();
          resolve();
        });
      } else {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
          resolve();
        }, 1200);
      }
    });
    this.process = null;
    await this.proxy.stop();
    this.logs.add("info", "Tunnel stopped.");
    return this.getState();
  }

  async getBinaryVersion(settings: AppSettings): Promise<string> {
    try {
      const binary = this.resolveBinary(settings.cloudflaredPath);
      return await new Promise<string>((resolve) => {
        const child = spawn(binary, ["--version"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let output = "";
        child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
        child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
        child.once("error", () => resolve("Unavailable"));
        child.once("exit", () => resolve(output.trim() || "Unavailable"));
      });
    } catch {
      return "Unavailable";
    }
  }

  resolveBinary(configuredPath: string): string {
    if (configuredPath) {
      if (!existsSync(configuredPath)) {
        throw new Error("The cloudflared path saved in Settings does not exist.");
      }
      return configuredPath;
    }
    const packaged = app.isPackaged
      ? path.join(process.resourcesPath, "bin", process.platform === "win32" ? "cloudflared.exe" : "cloudflared")
      : path.join(app.getAppPath(), "resources", "bin", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
    return existsSync(packaged) ? packaged : "cloudflared";
  }

  private setState(state: TunnelState): void {
    this.state = state;
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("tunnel:state", this.getState());
    }
  }
}
