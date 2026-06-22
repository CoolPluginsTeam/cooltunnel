import { mockApi } from "./mockApi";

export const api = window.coolTunnel ?? (import.meta.env.DEV ? mockApi : window.localToCloud);
