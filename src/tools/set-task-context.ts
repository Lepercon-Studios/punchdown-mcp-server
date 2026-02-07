import type { z } from "zod";
import type { SetTaskContextSchema } from "./index.js";
import { relayClient } from "../relay/websocket-client.js";
import { createEnvelope } from "../relay/protocol.js";
import { loadConfig } from "../config/store.js";

type SetTaskContextInput = z.infer<typeof SetTaskContextSchema>;

export async function setTaskContext(input: SetTaskContextInput) {
  console.error(`[punchdown] Task context updated: ${input.task_title}`);

  if (relayClient.connected) {
    const config = loadConfig();
    const pairedDevice = config.pairedDevices?.[0];
    if (pairedDevice && config.deviceId && config.encryptionKeypair) {
      const envelope = createEnvelope(
        config.deviceId,
        pairedDevice.id,
        "set_task_context",
        JSON.stringify({
          task_title: input.task_title,
          task_description: input.task_description,
          estimated_completion: input.estimated_completion,
          files_involved: input.files_involved,
        }),
        pairedDevice.encryptionPublicKey,
        config.encryptionKeypair.secretKey
      );
      relayClient.send(envelope).catch((err) => {
        console.error("[punchdown] Failed to send task context:", err);
      });
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ updated: true }),
      },
    ],
  };
}
