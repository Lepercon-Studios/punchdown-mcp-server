import type { z } from "zod";
import type { RequestInputSchema } from "./index.js";

type RequestInputInput = z.infer<typeof RequestInputSchema>;

export async function requestInput(input: RequestInputInput) {
  // TODO: Send to relay via WebSocket, await response
  console.error(`[punchdown] Input requested: ${input.question}`);

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
