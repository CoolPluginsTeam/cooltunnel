import { useEffect, useState } from "react";
import type { ThemePreference } from "../shared/types";
import { legacyUrlToProfile } from "../shared/profile";
import { Sidebar, type PageId } from "./components/Sidebar";
import { api } from "./lib/api";
import { Dashboard } from "./pages/Dashboard";
import { About } from "./pages/About";
import { Logs } from "./pages/Logs";
import { Profiles } from "./pages/Profiles";
import { Settings } from "./pages/Settings";
import { Sites } from "./pages/Sites";

function applyTheme(theme: ThemePreference) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && prefersDark));
}

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");

  useEffect(() => {
    void api.settings.get().then((settings) => applyTheme(settings.theme));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => void api.settings.get().then((settings) => applyTheme(settings.theme));
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    void (async () => {
      const existing = await api.profiles.list();
      const legacyUrl = localStorage.getItem("localSiteUrl");
      if (!existing.length && legacyUrl) {
        try {
          await api.profiles.create(legacyUrlToProfile(legacyUrl));
        } catch { /* Invalid legacy values remain editable on Dashboard. */ }
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen bg-cloud text-ink dark:bg-slate-900 dark:text-slate-100">
      <Sidebar active={page} onNavigate={setPage} />
      <main className="min-w-0 flex-1 overflow-auto">
        {page === "dashboard" && <Dashboard onOpenLogs={() => setPage("logs")} />}
        {page === "profiles" && <Profiles />}
        {page === "sites" && <Sites />}
        {page === "settings" && <Settings onThemeChange={applyTheme} />}
        {page === "logs" && <Logs />}
        {page === "about" && <About />}
      </main>
    </div>
  );
}
