import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import type { AppSettings, ThemePreference } from "../../shared/types";
import { Toast, type ToastMessage } from "../components/Toast";
import { api } from "../lib/api";
import { BRAND } from "../../shared/brand";

export function Settings({ onThemeChange }: { onThemeChange: (theme: ThemePreference) => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [folders, setFolders] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    void api.settings.get().then((value) => {
      setSettings(value);
      setFolders(value.scanFolders.join("\n"));
    });
  }, []);

  if (!settings) return <div className="p-8 text-sm text-slate-500">Loading settings…</div>;

  const save = async () => {
    try {
      const next = await api.settings.update({
        ...settings,
        scanFolders: folders.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
      });
      setSettings(next);
      setFolders(next.scanFolders.join("\n"));
      onThemeChange(next.theme);
      setToast({ kind: "success", text: "Settings saved." });
    } catch (error) {
      setToast({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };

  const reset = async () => {
    if (!window.confirm(`Reset every ${BRAND.productName} setting to its default value?`)) return;
    const next = await api.settings.reset();
    setSettings(next);
    setFolders(next.scanFolders.join("\n"));
    onThemeChange(next.theme);
    setToast({ kind: "success", text: "Settings reset." });
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <header className="mb-7">
        <p className="mb-1 text-sm font-semibold text-brand-600">Preferences</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Choose where the app looks and how it behaves.</p>
      </header>

      <section className="panel space-y-6">
        <div>
          <label className="label" htmlFor="binary-path">cloudflared binary path</label>
          <input
            id="binary-path"
            className="input"
            value={settings.cloudflaredPath}
            onChange={(event) => setSettings({ ...settings, cloudflaredPath: event.target.value })}
            placeholder="Leave blank to use resources/bin or the system command"
          />
          <p className="mt-2 text-xs text-slate-500">Example: C:\Tools\cloudflared.exe</p>
        </div>

        <div>
          <label className="label" htmlFor="scan-folders">Default local folders to scan</label>
          <textarea
            id="scan-folders"
            className="input min-h-40 resize-y font-mono text-xs leading-6"
            value={folders}
            onChange={(event) => setFolders(event.target.value)}
            spellCheck={false}
          />
          <p className="mt-2 text-xs text-slate-500">Enter one folder per line.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <input
              type="checkbox"
              checked={settings.autoStopOnClose}
              onChange={(event) => setSettings({ ...settings, autoStopOnClose: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded text-brand-600"
            />
            <span>
              <span className="block text-sm font-semibold">Auto-stop on app close</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Recommended so no tunnel is left running.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <input
              type="checkbox"
              checked={settings.keepWordPressFix}
              onChange={(event) => setSettings({ ...settings, keepWordPressFix: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded text-brand-600"
            />
            <span>
              <span className="block text-sm font-semibold">Keep WordPress fix after stopping</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Otherwise the app asks before removing session fixes.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <input
              type="checkbox"
              checked={settings.autoCheckUpdates}
              onChange={(event) => setSettings({ ...settings, autoCheckUpdates: event.target.checked })}
              className="mt-0.5 h-4 w-4 rounded text-brand-600"
            />
            <span>
              <span className="block text-sm font-semibold">Check for stable updates</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Checks shortly after launch and every six hours.</span>
            </span>
          </label>
        </div>

        <div>
          <label className="label" htmlFor="theme">App theme</label>
          <select
            id="theme"
            className="input"
            value={settings.theme}
            onChange={(event) => {
              const theme = event.target.value as ThemePreference;
              setSettings({ ...settings, theme });
              onThemeChange(theme);
            }}
          >
            <option value="system">Use system setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="flex gap-3 border-t border-slate-200 pt-6 dark:border-slate-700">
          <button className="button-primary" onClick={save}><Save size={17} /> Save Settings</button>
          <button className="button-secondary ml-auto" onClick={reset}><RotateCcw size={17} /> Reset Settings</button>
        </div>
      </section>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
