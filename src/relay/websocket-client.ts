import WebSocket from "ws";
import type { RelayEnvelope } from "./protocol.js";

export interface RelayConfig {
  url: string;
  deviceId: string;
  authToken: string;
}

type MessageHandler = (envelope: RelayEnvelope) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: RelayConfig | null = null;
  private messageHandler: MessageHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private shouldReconnect = true;

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async connect(config: RelayConfig): Promise<void> {
    this.config = config;
    this.shouldReconnect = true;
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new Error("No relay config"));
        return;
      }

      const url = `${this.config.url}/ws/device?token=${encodeURIComponent(this.config.authToken)}`;

      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.on("open", () => {
        console.error("[punchdown] Connected to relay");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as RelayEnvelope;
          if (message.type === "ping") {
            this.sendRaw(
              JSON.stringify({
                id: message.id,
                from: this.config!.deviceId,
                to: message.from,
                type: "pong",
                timestamp: Date.now(),
              })
            );
            return;
          }
          this.messageHandler?.(message);
        } catch (err) {
          console.error("[punchdown] Failed to parse message:", err);
        }
      });

      this.ws.on("close", () => {
        console.error("[punchdown] Disconnected from relay");
        this.isConnected = false;
        this.stopHeartbeat();
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (err) => {
        console.error("[punchdown] WebSocket error:", err.message);
        if (!this.isConnected) {
          reject(err);
        }
      });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    // Server sends ping every 30s — we respond in the message handler
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[punchdown] Max reconnect attempts reached");
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    console.error(
      `[punchdown] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );
    this.reconnectTimer = setTimeout(() => {
      this.doConnect().catch((err) => {
        console.error("[punchdown] Reconnect failed:", err.message);
      });
    }, delay);
  }

  private sendRaw(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  async send(envelope: RelayEnvelope): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify(envelope));
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const relayClient = new WebSocketClient();
