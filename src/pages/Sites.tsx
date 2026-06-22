import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw, Search, ShieldCheck, Trash2, Wrench } from "lucide-react";
import type { WordPressSite } from "../../shared/types";
import { Toast, type ToastMessage } from "../components/Toast";
import { api } from "../lib/api";
import { siteHintFromLocalUrl } from "../lib/url";
import { BRAND } from "../../shared/brand";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function Sites() {
  const [sites, setSites] = useState<WordPressSite[]>([]);
  const [selected, setSelected] = useState<WordPressSite | null>(null);
  const [fixHtaccess, setFixHtaccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const scan = async () => {
    setBusy(true);
    try {
      const siteHint = siteHintFromLocalUrl(localStorage.getItem("localSiteUrl") || "");
      const found = await api.wordpress.scan(siteHint);
      setSites(found);
      if (!selected && found[0]) setSelected(found[0]);
      if (!found.length) setToast({ kind: "error", text: "No WordPress sites were found in the configured folders." });
    } catch (error) {
      setToast({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void scan();
  }, []);

  const chooseFolder = async () => {
    try {
      const site = await api.wordpress.chooseFolder();
      if (!site) return;
      setSites((current) => [site, ...current.filter((item) => item.path !== site.path)]);
      setSelected(site);
    } catch (error) {
      setToast({ kind: "error", text: errorText(error) });
    }
  };

  const applyFix = async () => {
    if (!selected) return;
    let pathname = "";
    const localUrl = localStorage.getItem("localSiteUrl") || "http://localhost";
    try {
      pathname = (await api.tunnel.parseUrl(localUrl)).pathname;
    } catch {
      // The tunnel URL can be entered later; root behavior remains the safe fallback.
    }
    const detail = fixHtaccess ? "wp-config.php and .htaccess" : "wp-config.php";
    const publicPath = pathname || "/";
    if (!window.confirm(`Apply the ${BRAND.productName} fix to ${detail} inside:\n\n${selected.path}\n\nPublic path: ${publicPath}\n\nA timestamped backup will be created first.`)) return;
    setBusy(true);
    try {
      const results = await api.wordpress.applyFix(selected.path, fixHtaccess, pathname, localUrl);
      setToast({ kind: "success", text: results.map((item) => item.message).join(" ") });
    } catch (error) {
      setToast({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const removeFix = async () => {
    if (!selected) return;
    if (!window.confirm(`Remove only the marked ${BRAND.productName} blocks from:\n\n${selected.path}\n\nA backup will be created before any change.`)) return;
    setBusy(true);
    try {
      const results = await api.wordpress.removeFix(selected.path, fixHtaccess);
      setToast({ kind: "success", text: results.map((item) => item.message).join(" ") });
    } catch (error) {
      setToast({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-7">
        <p className="mb-1 text-sm font-semibold text-brand-600">WordPress Fix</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Local WordPress sites</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Make WordPress recognize the temporary Cloudflare hostname without changing database credentials.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Detected sites</h2>
            <button className="button-secondary !px-3 !py-2" onClick={scan} disabled={busy} title="Scan again">
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="space-y-2">
            {sites.map((site) => (
              <button
                key={site.path}
                onClick={() => setSelected(site)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.path === site.path
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <FolderOpen size={17} className="text-brand-600" /> {site.name}
                </div>
                <div className="mt-1 truncate text-xs text-slate-500" title={site.path}>{site.path}</div>
                {site.source === "localwp" && (
                  <div className="mt-2 text-[11px] font-bold uppercase tracking-wide text-violet-600">LocalWP</div>
                )}
              </button>
            ))}
            {!sites.length && (
              <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                <Search className="mx-auto mb-2" size={24} />
                No sites detected yet
              </div>
            )}
          </div>
          <button className="button-secondary mt-4 w-full" onClick={chooseFolder}>
            <FolderOpen size={17} /> Choose Folder
          </button>
        </section>

        <section className="panel">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h2 className="font-bold">Safe configuration update</h2>
              <p className="text-sm text-slate-500">Only marked blocks are added or removed.</p>
            </div>
          </div>

          <label className="label">Confirmed WordPress path</label>
          <div className="min-h-11 break-all rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            {selected?.path || "Choose a valid WordPress folder first."}
          </div>

          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            The fix reads Cloudflare’s forwarded host, uses it only when it ends in <strong>trycloudflare.com</strong>, and leaves your database settings untouched.
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <input
              type="checkbox"
              checked={fixHtaccess}
              onChange={(event) => setFixHtaccess(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span>
              <span className="block text-sm font-semibold">Fix /wp-admin without trailing slash</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Also manage a marked redirect block in .htaccess.
              </span>
            </span>
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="button-primary" onClick={applyFix} disabled={!selected || busy}>
              <Wrench size={17} /> Apply WordPress Tunnel Fix
            </button>
            <button className="button-secondary text-red-600" onClick={removeFix} disabled={!selected || busy}>
              <Trash2 size={17} /> Remove Fix
            </button>
          </div>
        </section>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
