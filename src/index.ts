#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions, handleToolCall } from "./tools/index.js";
import { loadConfig } from "./config/store.js";
import { relayClient } from "./relay/websocket-client.js";
import { pendingRequests } from "./relay/pending-requests.js";
import { decrypt } from "./crypto/encryption.js";
import { createAuthToken } from "./auth/tokens.js";
import type { RelayEnvelope } from "./relay/protocol.js";

const server = new Server(
  { name: "punchdown", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleToolCall(request.params.name, request.params.arguments ?? {});
});

// Connect to relay if paired
const config = loadConfig();
const hasPairedDevices = config.pairedDevices && config.pairedDevices.length > 0;

if (hasPairedDevices && config.deviceId && config.keypair && config.relayUrl) {
  const authToken = createAuthToken(
    config.deviceId,
    "desktop",
    config.keypair.secretKey
  );

  relayClient.onMessage((envelope: RelayEnvelope) => {
    handleRelayMessage(envelope);
  });

  relayClient
    .connect({
      url: config.relayUrl.replace(/^http/, "ws"),
      deviceId: config.deviceId,
      authToken,
    })
    .catch((err) => {
      console.error("[punchdown] Failed to connect to relay:", err.message);
    });
}

function handleRelayMessage(envelope: RelayEnvelope): void {
  if (
    envelope.type === "approval_response" ||
    envelope.type === "input_response"
  ) {
    if (!envelope.payload) {
      console.error("[punchdown] Response missing payload");
      return;
    }

    // Decrypt the response
    const pairedDevice = config.pairedDevices?.[0];
    if (!pairedDevice || !config.encryptionKeypair) {
      console.error("[punchdown] No paired device for decryption");
      return;
    }

    try {
      const decrypted = decrypt(
        envelope.payload.ciphertext,
        envelope.payload.nonce,
        pairedDevice.encryptionPublicKey,
        config.encryptionKeypair.secretKey
      );
      const response = JSON.parse(decrypted);
      pendingRequests.resolve(envelope.id, response);
    } catch (err) {
      console.error("[punchdown] Failed to decrypt response:", err);
    }
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
