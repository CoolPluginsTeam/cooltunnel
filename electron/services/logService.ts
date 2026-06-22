import { BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import type { LogEntry } from "../../shared/types";

export class LogService {
  private entries: LogEntry[] = [];
  private pending: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  add(level: LogEntry["level"], message: string): LogEntry {
    const entry: LogEntry = {
      id: randomUUID(),
      time: new Date().toISOString(),
      level,
      message: message.trim()
    };
    if (!entry.message) return entry;
    this.entries.push(entry);
    if (this.entries.length > 1000) this.entries.splice(0, this.entries.length - 1000);
    this.pending.push(entry);
    this.scheduleFlush();
    return entry;
  }

  get(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.pending = [];
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("logs:cleared");
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const entries = this.pending.splice(0);
      if (!entries.length) return;
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("logs:entries", entries);
      }
    }, 100);
  }
}
