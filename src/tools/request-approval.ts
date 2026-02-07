import type { z } from "zod";
import type { RequestApprovalSchema } from "./index.js";
import { relayClient } from "../relay/websocket-client.js";
import { pendingRequests } from "../relay/pending-requests.js";
import { createEnvelope } from "../relay/protocol.js";
import { loadConfig } from "../config/store.js";

type RequestApprovalInput = z.infer<typeof RequestApprovalSchema>;

export async function requestApproval(input: RequestApprovalInput) {
  console.error(`[punchdown] Approval requested: ${input.action_summary}`);

  if (!relayClient.connected) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            decision: "approved",
            user_message: "Auto-approved (relay not connected)",
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
            decision: "approved",
            user_message: "Auto-approved (not paired)",
          }),
        },
      ],
    };
  }

  const envelope = createEnvelope(
    config.deviceId,
    pairedDevice.id,
    "request_approval",
    JSON.stringify({
      action_summary: input.action_summary,
      details: input.details,
      risk_level: input.risk_level,
      options: input.options,
    }),
    pairedDevice.encryptionPublicKey,
    config.encryptionKeypair.secretKey
  );

  try {
    await relayClient.send(envelope);
    const response = await pendingRequests.add(envelope.id, "approval", 300_000);
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
              decision: "timeout",
              user_message: "Request timed out",
            }),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ decision: "error", user_message: message }),
        },
      ],
    };
  }
}
