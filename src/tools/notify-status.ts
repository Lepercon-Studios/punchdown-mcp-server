import type { z } from "zod";
import type { NotifyStatusSchema } from "./index.js";

type NotifyStatusInput = z.infer<typeof NotifyStatusSchema>;

export async function notifyStatus(input: NotifyStatusInput) {
  // TODO: Send to relay via WebSocket (fire-and-forget)
  console.error(`[punchdown] Status: [${input.event}] ${input.message}`);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ delivered: true }),
      },
    ],
  };
}
