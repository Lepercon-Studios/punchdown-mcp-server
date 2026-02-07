import type { z } from "zod";
import type { SetTaskContextSchema } from "./index.js";

type SetTaskContextInput = z.infer<typeof SetTaskContextSchema>;

export async function setTaskContext(input: SetTaskContextInput) {
  // TODO: Send to relay via WebSocket (fire-and-forget)
  console.error(`[punchdown] Task context updated: ${input.task_title}`);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ updated: true }),
      },
    ],
  };
}
