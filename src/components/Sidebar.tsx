import {
  Info,
  LayoutDashboard,
  ListTree,
  PanelsTopLeft,
  ScrollText,
  Settings
} from "lucide-react";
import iconUrl from "../../resources/branding/cooltunnel-icon.svg";
import { BRAND } from "../../shared/brand";

export type PageId = "dashboard" | "profiles" | "sites" | "settings" | "logs" | "about";

interface SidebarProps {
  active: PageId;
  onNavigate: (page: PageId) => void;
}

const items = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "profiles" as const, label: "Profiles", icon: PanelsTopLeft },
  { id: "sites" as const, label: "WordPress", icon: ListTree },
  { id: "settings" as const, label: "Settings", icon: Settings },
  { id: "logs" as const, label: "Logs", icon: ScrollText },
  { id: "about" as const, label: "About", icon: Info }
];

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-9 flex items-center gap-3 px-2">
        <img className="h-10 w-10 rounded-xl shadow-lg shadow-brand-500/20" src={iconUrl} alt="" />
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{BRAND.productName}</div>
          <div className="text-xs text-slate-500">by {BRAND.companyBrand}</div>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
              active === id
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        Your site data stays on this computer. No telemetry is collected.
      </div>
    </aside>
  );
}
