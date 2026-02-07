import type { z } from "zod";
import type { RequestApprovalSchema } from "./index.js";

type RequestApprovalInput = z.infer<typeof RequestApprovalSchema>;

export async function requestApproval(input: RequestApprovalInput) {
  // TODO: Send to relay via WebSocket, await response
  console.error(`[punchdown] Approval requested: ${input.action_summary}`);

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
