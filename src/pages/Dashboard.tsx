import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Clipboard,
  CloudCog,
  ExternalLink,
  Play,
  ScrollText,
  Square
} from "lucide-react";
import type { CompatibilityReport, ParsedLocalUrl, TunnelState } from "../../shared/types";
import { StatusBadge } from "../components/StatusBadge";
import { Toast, type ToastMessage } from "../components/Toast";
import { api } from "../lib/api";

const INITIAL_STATE: TunnelState = {
  status: "idle",
  publicUrl: null,
  error: null,
  command: null
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function Dashboard({ onOpenLogs }: { onOpenLogs: () => void }) {
  const [localUrl, setLocalUrl] = useState(() => localStorage.getItem("localSiteUrl") || "https://plugins.test");
  const [parsed, setParsed] = useState<ParsedLocalUrl | null>(null);
  const [parseError, setParseError] = useState("");
  const [ignoreSsl, setIgnoreSsl] = useState(true);
  const [state, setState] = useState<TunnelState>(INITIAL_STATE);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityReport | null>(null);
  const [checkingCompatibility, setCheckingCompatibility] = useState(false);

  useEffect(() => {
    void api.tunnel.getState().then(setState);
    return api.tunnel.onState(setState);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void api.tunnel.parseUrl(localUrl)
        .then((value) => {
          setParsed(value);
          setParseError("");
          setIgnoreSsl(value.ignoreSsl);
          localStorage.setItem("localSiteUrl", localUrl);
        })
        .catch((error) => {
          setParsed(null);
          setParseError(errorText(error));
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [localUrl]);

  useEffect(() => {
    if (state.status !== "active" || !state.publicUrl || !parsed) {
      setCompatibility(null);
      return;
    }
    let cancelled = false;
    setCheckingCompatibility(true);
    const timer = window.setTimeout(() => {
      void api.wordpress.checkCompatibility(state.publicUrl!, localUrl)
        .then((report) => {
          if (!cancelled) setCompatibility(report);
        })
        .finally(() => {
          if (!cancelled) setCheckingCompatibility(false);
        });
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.status, state.publicUrl, localUrl, parsed]);

  const start = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      await api.tunnel.start({ localUrl, ignoreSsl });
    } catch (error) {
      setToast({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const settings = await api.settings.get();
      let removeSessionFixes = false;
      if (!settings.keepWordPressFix) {
        removeSessionFixes = window.confirm(
          "Your settings say WordPress tunnel fixes should be removed when the tunnel stops. Remove fixes applied during this app session now?"
        );
      }
      await api.tunnel.stop({ removeSessionFixes });
      setToast({ kind: "success", text: "Tunnel stopped." });
    } catch (error) {
      setToast({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!state.publicUrl) return;
    await api.app.copyText(state.publicUrl);
    setToast({ kind: "success", text: "Public URL copied." });
  };

  const isRunning = state.status === "starting" || state.status === "active";

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-7 flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold text-brand-600">One-click sharing</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Tunnel dashboard</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Turn a local development site into a temporary public link.
          </p>
        </div>
        <StatusBadge status={state.status} />
      </header>

      <section className="panel mb-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <CloudCog size={21} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Local site</h2>
            <p className="text-sm text-slate-500">Enter the address you normally open in your browser.</p>
          </div>
        </div>

        <label className="label" htmlFor="local-url">Local Site URL</label>
        <input
          id="local-url"
          className="input text-base"
          value={localUrl}
          onChange={(event) => setLocalUrl(event.target.value)}
          placeholder="https://plugins.test"
          disabled={isRunning}
        />
        {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}

        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-6">
          {[
            ["Protocol", parsed?.protocol || "—"],
            ["Host", parsed?.host || "—"],
            ["Port", parsed?.port ? String(parsed.port) : "—"],
            ["Local origin", parsed?.origin || "—"],
            ["Public path", parsed?.pathname || "/"],
            ["Router mode", parsed?.routerMode === "site-domain" ? "Site Domains" : parsed?.routerMode || "—"]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={value}>{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Host header</label>
            <input className="input bg-slate-50 dark:bg-slate-900" value={parsed?.hostHeader || ""} readOnly />
          </div>
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-2.5 dark:border-slate-700">
            <input
              type="checkbox"
              checked={ignoreSsl}
              onChange={(event) => setIgnoreSsl(event.target.checked)}
              disabled={parsed?.protocol !== "https" || isRunning}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="text-sm font-medium">Ignore local SSL verification</span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="button-primary" onClick={start} disabled={!parsed || busy || isRunning}>
            <Play size={17} fill="currentColor" /> Start Tunnel
          </button>
          <button className="button-danger" onClick={stop} disabled={busy || !isRunning}>
            <Square size={16} fill="currentColor" /> Stop Tunnel
          </button>
          <button className="button-secondary ml-auto" onClick={onOpenLogs}>
            <ScrollText size={17} /> View Logs
          </button>
        </div>
      </section>

      <section className={`panel transition ${state.publicUrl ? "border-emerald-200 dark:border-emerald-800" : ""}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <ArrowUpRight size={16} /> Public URL
            </div>
            <div className={`truncate text-lg font-bold ${state.publicUrl ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>
              {state.publicUrl || (state.status === "starting" ? "Waiting for Cloudflare…" : "Start a tunnel to create a public URL")}
            </div>
            {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="button-secondary" onClick={copyUrl} disabled={!state.publicUrl}>
              <Clipboard size={17} /> Copy
            </button>
            <button
              className="button-secondary"
              onClick={() => state.publicUrl && api.app.openExternal(state.publicUrl)}
              disabled={!state.publicUrl}
            >
              <ExternalLink size={17} /> Open
            </button>
          </div>
        </div>
        {state.command && (
          <div className="mt-5 rounded-xl bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-300">
            {state.command}
          </div>
        )}
        {(checkingCompatibility || compatibility) && (
          <div className={`mt-4 rounded-xl border p-3 text-sm ${
            compatibility?.status === "compatible"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              : compatibility?.status === "fix-required"
                ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900"
          }`}>
            <strong>WordPress compatibility:</strong>{" "}
            {checkingCompatibility ? "Checking public links…" : compatibility?.message}
          </div>
        )}
      </section>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
