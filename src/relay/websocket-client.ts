// WebSocket client for connecting to the Punchdown cloud relay

export interface RelayConfig {
  url: string;
  deviceId: string;
  authToken: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: RelayConfig | null = null;

  async connect(config: RelayConfig): Promise<void> {
    this.config = config;
    // TODO: Establish WSS connection to relay
    console.error("[punchdown] WebSocket client: connect() stub");
  }

  async send(message: unknown): Promise<void> {
    // TODO: Encrypt and send message
    console.error("[punchdown] WebSocket client: send() stub");
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }
}

export const relayClient = new WebSocketClient();
