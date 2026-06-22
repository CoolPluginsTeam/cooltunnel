/// <reference types="vite/client" />

import type { CoolTunnelApi } from "../shared/types";

declare global {
  interface Window {
    coolTunnel: CoolTunnelApi;
    localToCloud: CoolTunnelApi;
  }
}

export {};
