import type { z } from "zod";
import type { NotifyStatusSchema } from "./index.js";
import { relayClient } from "../relay/websocket-client.js";
import { createEnvelope } from "../relay/protocol.js";
import { loadConfig } from "../config/store.js";

type NotifyStatusInput = z.infer<typeof NotifyStatusSchema>;

export async function notifyStatus(input: NotifyStatusInput) {
  console.error(`[punchdown] Status: [${input.event}] ${input.message}`);

  if (relayClient.connected) {
    const config = loadConfig();
    const pairedDevice = config.pairedDevices?.[0];
    if (pairedDevice && config.deviceId && config.encryptionKeypair) {
      const envelope = createEnvelope(
        config.deviceId,
        pairedDevice.id,
        "notify_status",
        JSON.stringify({
          event: input.event,
          message: input.message,
          metadata: input.metadata,
        }),
        pairedDevice.encryptionPublicKey,
        config.encryptionKeypair.secretKey
      );
      relayClient.send(envelope).catch((err) => {
        console.error("[punchdown] Failed to send status:", err);
      });
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ delivered: relayClient.connected }),
      },
    ],
  };
}
