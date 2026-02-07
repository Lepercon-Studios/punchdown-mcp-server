import type { z } from "zod";
import type { RequestInputSchema } from "./index.js";
import { relayClient } from "../relay/websocket-client.js";
import { pendingRequests } from "../relay/pending-requests.js";
import { createEnvelope } from "../relay/protocol.js";
import { loadConfig } from "../config/store.js";

type RequestInputInput = z.infer<typeof RequestInputSchema>;

export async function requestInput(input: RequestInputInput) {
  console.error(`[punchdown] Input requested: ${input.question}`);

  if (!relayClient.connected) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            response: "Placeholder response (relay not connected)",
          }),
        },
      ],
    };
  }

  const config = loadConfig();
  const pairedDevice = config.pairedDevices?.[0];
  if (!pairedDevice || !config.deviceId || !config.encryptionKeypair) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            response: "Placeholder response (not paired)",
          }),
        },
      ],
    };
  }

  const envelope = createEnvelope(
    config.deviceId,
    pairedDevice.id,
    "request_input",
    JSON.stringify({
      question: input.question,
      context: input.context,
      suggestions: input.suggestions,
    }),
    pairedDevice.encryptionPublicKey,
    config.encryptionKeypair.secretKey
  );

  try {
    await relayClient.send(envelope);
    const timeoutMs = (input.timeout_seconds ?? 300) * 1000;
    const response = await pendingRequests.add(envelope.id, "input", timeoutMs);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timed out")) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              response: null,
              error: "Request timed out",
            }),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ response: null, error: message }),
        },
      ],
    };
  }
}
