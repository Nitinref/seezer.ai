import type { PipelineEvent } from "@/types";

// The frontend is normally served on :3000 while the API/WebSocket server is
// on :3001. The old fallback pointed back at Next.js (:3000), so a missing or
// stale public env value silently prevented the browser from ever opening a
// WebSocket. Keep an explicit deployment URL when supplied; otherwise derive
// the current host and connect to the backend port.
const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL;
const WS_URL = configuredWsUrl && !/^(?:ws|wss):\/\/localhost:3000\/?$/i.test(configuredWsUrl)
  ? configuredWsUrl.replace(/\/$/, "")
  : typeof window === "undefined"
    ? "ws://localhost:3001"
    : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:3001`;

export type WsEventHandler = (event: PipelineEvent) => void;

export class ForgeWebSocket {
  private ws: WebSocket | null = null;
  private chatId: string;
  private token: string;
  private handlers: Set<WsEventHandler> = new Set();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  constructor(chatId: string, token: string) {
    this.chatId = chatId;
    this.token = token;
  }

  connect() {
    this.shouldReconnect = true;
    const url = `${WS_URL}/ws/${this.chatId}?token=${this.token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.emit({ type: "connected", chatId: this.chatId, ts: Date.now() } as PipelineEvent & { chatId: string });
      this.startPing();
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as PipelineEvent;
        this.handlers.forEach((h) => h(msg));
      } catch {}
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = () => {};
  }

  on(handler: WsEventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private emit(event: PipelineEvent) {
    this.handlers.forEach((h) => h(event));
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }
}
