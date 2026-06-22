import type { TunnelStatus } from "../../shared/types";

const styles: Record<TunnelStatus, string> = {
  idle: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
  starting: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  stopped: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
  error: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
};

export function StatusBadge({ status }: { status: TunnelStatus }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold capitalize ${styles[status]}`}>
      <span className={`h-2 w-2 rounded-full ${status === "active" ? "animate-pulse bg-emerald-500" : "bg-current"}`} />
      {status}
    </span>
  );
}
