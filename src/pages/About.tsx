import { useEffect, useState } from "react";
import { Download, ExternalLink, FileArchive, RefreshCw, RotateCw } from "lucide-react";
import type { AppVersionInfo, BrandInfo, UpdateState } from "../../shared/types";
import { Toast, type ToastMessage } from "../components/Toast";
import { api } from "../lib/api";

export function About() {
  const [versions, setVersions] = useState<AppVersionInfo | null>(null);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [includePaths, setIncludePaths] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    void api.app.getVersions().then(setVersions);
    void api.app.getBrand().then(setBrand);
    void api.updates.getState().then(setUpdate);
    return api.updates.onState(setUpdate);
  }, []);

  const exportDiagnostics = async () => {
    const file = await api.diagnostics.export({ includePaths });
    if (file) setToast({ kind: "success", text: "Diagnostic bundle exported." });
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <header className="mb-7">
        <p className="mb-1 text-sm font-semibold text-brand-600">Product and support</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">About & Updates</h1>
        {brand && (
          <div className="mt-4">
            <div className="text-xl font-bold">{brand.lockup}</div>
            <div className="mt-1 text-sm text-slate-500">{brand.tagline}</div>
            <div className="mt-2 text-sm text-slate-500">{brand.credit}</div>
          </div>
        )}
      </header>

      <section className="panel mb-6">
        <h2 className="mb-4 text-lg font-bold">Version information</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {versions && Object.entries(versions).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
              <div className="mt-1 break-all text-sm font-medium">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Software updates</h2>
            <p className="mt-1 text-sm text-slate-500">
              {update?.status === "disabled"
                ? "Update checks work in installed release builds."
                : update?.status === "available"
                  ? `Version ${update.availableVersion} is available.`
                  : update?.status === "downloaded"
                    ? `Version ${update.availableVersion} is ready to install.`
                    : update?.status === "not-available"
                      ? "You are using the latest version."
                      : update?.error || "Stable channel"}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="button-secondary" onClick={() => api.updates.check()} disabled={update?.status === "checking"}>
              <RefreshCw size={17} className={update?.status === "checking" ? "animate-spin" : ""} /> Check
            </button>
            {update?.status === "available" && (
              <button className="button-primary" onClick={() => api.updates.download()}><Download size={17} /> Download</button>
            )}
            {update?.status === "downloaded" && (
              <button className="button-primary" onClick={() => api.updates.install()}><RotateCw size={17} /> Install & Restart</button>
            )}
          </div>
        </div>
        {update?.status === "downloading" && (
          <div className="mt-5">
            <div className="mb-2 text-sm font-semibold">Downloading {update.percent ?? 0}%</div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${update.percent ?? 0}%` }} />
            </div>
          </div>
        )}
        {update?.releaseNotes && <pre className="mt-5 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs text-slate-300">{update.releaseNotes}</pre>}
      </section>

      <section className="panel">
        <h2 className="text-lg font-bold">Support diagnostics</h2>
        <p className="mt-1 text-sm text-slate-500">
          Export versions, recent logs, settings, tunnel state, and scan results. Personal paths are redacted by default.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includePaths} onChange={(event) => setIncludePaths(event.target.checked)} />
          Include local filesystem paths
        </label>
        <button className="button-secondary mt-4" onClick={exportDiagnostics}>
          <FileArchive size={17} /> Export Diagnostic Bundle
        </button>
      </section>
      {brand && (
        <section className="panel mt-6">
          <h2 className="text-lg font-bold">Product links</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["Product website", brand.urls.product],
              ["Cool Plugins", brand.urls.company],
              ["Documentation", brand.urls.documentation],
              ["Support", brand.urls.support],
              ["Privacy", brand.urls.privacy],
              ["MIT License", brand.urls.license],
              ["Third-party notices", brand.urls.thirdPartyNotices],
              ["Source code", brand.urls.source],
              ["Release notes", brand.urls.releaseNotes]
            ].map(([label, url]) => (
              <button key={label} className="button-secondary justify-between" onClick={() => api.app.openExternal(url)}>
                {label} <ExternalLink size={15} />
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            CoolTunnel is an independent open-source utility. Cloudflare, WordPress, Local, Laragon, XAMPP and WampServer
            are trademarks of their respective owners and are not affiliated with Cool Plugins LLP.
          </p>
        </section>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
