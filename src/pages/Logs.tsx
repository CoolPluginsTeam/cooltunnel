import { useEffect, useRef, useState } from "react";
import { Clipboard, Trash2 } from "lucide-react";
import type { LogEntry } from "../../shared/types";
import { Toast, type ToastMessage } from "../components/Toast";
import { api } from "../lib/api";

const colors: Record<LogEntry["level"], string> = {
  info: "text-sky-300",
  output: "text-slate-300",
  error: "text-red-300",
  success: "text-emerald-300"
};

export function Logs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.logs.get().then(setEntries);
    const offEntry = api.logs.onEntry((entry) => setEntries((current) => [...current, entry]));
    const offClear = api.logs.onClear(() => setEntries([]));
    return () => {
      offEntry();
      offClear();
    };
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [entries]);

  const copy = async () => {
    const text = entries.map((entry) => `[${entry.time}] ${entry.level.toUpperCase()} ${entry.message}`).join("\n");
    await api.app.copyText(text);
    setToast({ kind: "success", text: "Logs copied." });
  };

  return (
    <div className="flex h-screen flex-col p-8">
      <header className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold text-brand-600">Diagnostics</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Logs</h1>
          <p className="mt-2 text-sm text-slate-500">Live cloudflared output and app messages for this session.</p>
        </div>
        <div className="flex gap-2">
          <button className="button-secondary" onClick={copy} disabled={!entries.length}>
            <Clipboard size={17} /> Copy Logs
          </button>
          <button className="button-secondary text-red-600" onClick={() => api.logs.clear()} disabled={!entries.length}>
            <Trash2 size={17} /> Clear
          </button>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-auto rounded-2xl bg-slate-950 p-5 font-mono text-xs leading-6 shadow-panel">
        {!entries.length && <div className="text-slate-500">No logs yet. Start a tunnel to see live output.</div>}
        {entries.map((entry) => (
          <div key={entry.id} className="grid grid-cols-[88px_62px_1fr] gap-3">
            <span className="text-slate-600">{new Date(entry.time).toLocaleTimeString()}</span>
            <span className={`font-bold uppercase ${colors[entry.level]}`}>{entry.level}</span>
            <span className="whitespace-pre-wrap break-all text-slate-300">{entry.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </section>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
