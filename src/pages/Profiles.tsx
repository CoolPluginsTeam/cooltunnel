import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  FolderOpen,
  Play,
  Plus,
  Save,
  Star,
  Trash2,
  Upload
} from "lucide-react";
import type { ProfileSourceType, RouterMode, SiteProfile } from "../../shared/types";
import { Toast, type ToastMessage } from "../components/Toast";
import { api } from "../lib/api";

type Draft = Omit<SiteProfile, "id" | "createdAt" | "updatedAt">;

const emptyDraft: Draft = {
  name: "",
  localUrl: "http://localhost",
  wordpressPath: "",
  sourceType: "unknown",
  routerMode: "auto",
  ignoreSsl: false,
  publicPath: "",
  fixHtaccess: false,
  keepWordPressFix: true,
  favorite: false
};

function toDraft(profile: SiteProfile): Draft {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = profile;
  return draft;
}

export function Profiles() {
  const [profiles, setProfiles] = useState<SiteProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [includePaths, setIncludePaths] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = async () => {
    const items = await api.profiles.list();
    setProfiles(items.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)));
  };

  useEffect(() => { void load(); }, []);

  const select = (profile: SiteProfile) => {
    setSelectedId(profile.id);
    setDraft(toDraft(profile));
  };

  const chooseWordPress = async () => {
    try {
      const site = await api.wordpress.chooseFolder();
      if (!site) return;
      setDraft((current) => ({
        ...current,
        wordpressPath: site.path,
        sourceType: site.source === "localwp" ? "localwp" : "manual"
      }));
    } catch (error) {
      setToast({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      if (selectedId) await api.profiles.update(selectedId, draft);
      else {
        const created = await api.profiles.create(draft);
        setSelectedId(created.id);
      }
      await load();
      setToast({ kind: "success", text: "Profile saved." });
    } catch (error) {
      setToast({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId || !window.confirm(`Delete the profile “${draft.name}”?`)) return;
    await api.profiles.remove(selectedId);
    setSelectedId(null);
    setDraft(emptyDraft);
    await load();
  };

  const start = async (profile: SiteProfile) => {
    setBusy(true);
    try {
      localStorage.setItem("localSiteUrl", profile.localUrl);
      if (profile.wordpressPath) {
        await api.wordpress.applyFix(profile.wordpressPath, profile.fixHtaccess, profile.publicPath, profile.localUrl);
      }
      await api.tunnel.start({
        localUrl: profile.localUrl,
        ignoreSsl: profile.ignoreSsl,
        routerMode: profile.routerMode
      });
      setToast({ kind: "success", text: `${profile.name} is starting.` });
    } catch (error) {
      setToast({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const importProfiles = async () => {
    try {
      const preview = await api.profiles.previewImport();
      if (!preview) return;
      const invalidText = preview.invalid.length ? `\nInvalid entries: ${preview.invalid.length}` : "";
      const overwrite = window.confirm(
        `Import preview\n\nNew: ${preview.newProfiles}\nConflicts: ${preview.conflicts}${invalidText}\n\nOK overwrites conflicts. Cancel skips conflicts.`
      );
      const result = await api.profiles.commitImport(preview.filePath, overwrite ? "overwrite" : "skip");
      await load();
      setToast({
        kind: "success",
        text: `Imported ${result.imported}, overwritten ${result.overwritten}, skipped ${result.skipped}.`
      });
    } catch (error) {
      setToast({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };

  const exportProfiles = async () => {
    const file = await api.profiles.export(includePaths);
    if (file) setToast({ kind: "success", text: "Profile pack exported." });
  };

  return (
    <div className="mx-auto max-w-6xl p-8">
      <header className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold text-brand-600">Reusable setup</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Site profiles</h1>
          <p className="mt-2 text-sm text-slate-500">Save each local site once, then share it again in one click.</p>
        </div>
        <button className="button-primary" onClick={() => { setSelectedId(null); setDraft(emptyDraft); }}>
          <Plus size={17} /> New Profile
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="panel">
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === profile.id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                }`}
              >
                <button className="w-full text-left" onClick={() => select(profile)}>
                  <div className="flex items-center gap-2 font-semibold">
                    {profile.favorite && <Star size={15} className="fill-amber-400 text-amber-400" />}
                    <span className="truncate">{profile.name}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">{profile.localUrl}</div>
                </button>
                <button
                  className="button-secondary mt-3 !px-3 !py-1.5"
                  onClick={(event) => { event.stopPropagation(); void start(profile); }}
                  disabled={busy}
                >
                  <Play size={14} /> Start
                </button>
              </div>
            ))}
            {!profiles.length && <p className="py-8 text-center text-sm text-slate-500">No profiles yet.</p>}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
            <label className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" checked={includePaths} onChange={(event) => setIncludePaths(event.target.checked)} />
              Include machine-specific WordPress paths
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button className="button-secondary" onClick={exportProfiles} disabled={!profiles.length}>
                <Upload size={16} /> Export
              </button>
              <button className="button-secondary" onClick={importProfiles}>
                <Download size={16} /> Import
              </button>
            </div>
          </div>
        </section>

        <section className="panel space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Profile name</label>
              <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </div>
            <div>
              <label className="label">Source</label>
              <select className="input" value={draft.sourceType} onChange={(event) => setDraft({ ...draft, sourceType: event.target.value as ProfileSourceType })}>
                <option value="unknown">Auto / Unknown</option>
                <option value="laragon">Laragon</option>
                <option value="xampp">XAMPP</option>
                <option value="wamp">WAMP</option>
                <option value="localwp">LocalWP</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Local site URL</label>
            <input
              className="input"
              value={draft.localUrl}
              onChange={async (event) => {
                const localUrl = event.target.value;
                setDraft((current) => ({ ...current, localUrl }));
                try {
                  const parsed = await api.tunnel.parseUrl(localUrl);
                  setDraft((current) => ({ ...current, localUrl, publicPath: parsed.pathname, ignoreSsl: parsed.ignoreSsl }));
                } catch { /* Keep draft editable while incomplete. */ }
              }}
              placeholder="https://plugins.test"
            />
          </div>

          <div>
            <label className="label">Local router mode</label>
            <select
              className="input"
              value={draft.routerMode}
              onChange={(event) => setDraft({ ...draft, routerMode: event.target.value as RouterMode })}
            >
              <option value="auto">Auto-detect</option>
              <option value="site-domain">Local Site Domains (example.local)</option>
              <option value="localhost">Local localhost mode (localhost:10005)</option>
            </select>
          </div>

          <div>
            <label className="label">WordPress folder</label>
            <div className="flex gap-2">
              <input className="input" value={draft.wordpressPath} onChange={(event) => setDraft({ ...draft, wordpressPath: event.target.value })} />
              <button className="button-secondary shrink-0" onClick={chooseWordPress}><FolderOpen size={17} /></button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["favorite", "Favorite"],
              ["ignoreSsl", "Ignore local SSL verification"],
              ["fixHtaccess", "Fix wp-admin trailing slash"],
              ["keepWordPressFix", "Keep WordPress fix after stop"]
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(draft[field as keyof Draft])}
                  onChange={(event) => setDraft({ ...draft, [field]: event.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
            <button className="button-primary" onClick={save} disabled={busy}><Save size={17} /> Save Profile</button>
            {selectedId && (
              <>
                <button className="button-secondary" onClick={async () => { await api.profiles.duplicate(selectedId); await load(); }}>
                  <Copy size={17} /> Duplicate
                </button>
                <button className="button-secondary ml-auto text-red-600" onClick={remove}>
                  <Trash2 size={17} /> Delete
                </button>
              </>
            )}
          </div>
        </section>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
