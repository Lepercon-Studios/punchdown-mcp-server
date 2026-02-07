import { z } from "zod";
import { requestApproval } from "./request-approval.js";
import { requestInput } from "./request-input.js";
import { notifyStatus } from "./notify-status.js";
import { setTaskContext } from "./set-task-context.js";

// Schemas
export const RequestApprovalSchema = z.object({
  action_summary: z.string().describe("Brief summary of the action requiring approval"),
  details: z.string().optional().describe("Detailed description of changes"),
  risk_level: z.enum(["low", "medium", "high"]).default("medium").describe("Risk assessment"),
  options: z.array(z.string()).default(["approve", "deny"]).describe("Available response options"),
});

export const RequestInputSchema = z.object({
  question: z.string().describe("Question to ask the user"),
  context: z.string().optional().describe("Additional context for the question"),
  suggestions: z.array(z.string()).optional().describe("Suggested responses"),
  timeout_seconds: z.number().default(300).describe("Timeout in seconds"),
});

export const NotifyStatusSchema = z.object({
  event: z.enum(["milestone", "progress", "error", "complete"]).describe("Type of status event"),
  message: z.string().describe("Human-readable status message"),
  metadata: z.record(z.unknown()).optional().describe("Additional structured data"),
});

export const SetTaskContextSchema = z.object({
  task_title: z.string().describe("Title of the current task"),
  task_description: z.string().optional().describe("Detailed task description"),
  estimated_completion: z.string().optional().describe("Estimated time to completion"),
  files_involved: z.array(z.string()).optional().describe("List of files being worked on"),
});

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Minimal Zod-to-JSON-Schema converter for MCP tool registration
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodType;
      properties[key] = zodToJsonSchema(zodValue);
      if (!(zodValue instanceof z.ZodOptional) && !(zodValue instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    return { type: "object", properties, required };
  }
  if (schema instanceof z.ZodString) return { type: "string", description: schema.description };
  if (schema instanceof z.ZodNumber) return { type: "number", description: schema.description };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options, description: schema.description };
  if (schema instanceof z.ZodArray) return { type: "array", items: zodToJsonSchema((schema as z.ZodArray<z.ZodType>).element), description: schema.description };
  if (schema instanceof z.ZodOptional) return zodToJsonSchema((schema as z.ZodOptional<z.ZodType>)._def.innerType);
  if (schema instanceof z.ZodDefault) return zodToJsonSchema((schema as z.ZodDefault<z.ZodType>)._def.innerType);
  if (schema instanceof z.ZodRecord) return { type: "object", additionalProperties: true, description: schema.description };
  return {};
}

export const toolDefinitions = [
  {
    name: "request_approval",
    description: "Request approval from the user for an action. Blocks until the user responds via the Punchdown mobile app.",
    inputSchema: zodToJsonSchema(RequestApprovalSchema),
  },
  {
    name: "request_input",
    description: "Request free-form input from the user. Blocks until the user responds via the Punchdown mobile app.",
    inputSchema: zodToJsonSchema(RequestInputSchema),
  },
  {
    name: "notify_status",
    description: "Send a status update to the user's mobile device. Does not block the agent.",
    inputSchema: zodToJsonSchema(NotifyStatusSchema),
  },
  {
    name: "set_task_context",
    description: "Update the mobile dashboard with current task information. Does not block the agent.",
    inputSchema: zodToJsonSchema(SetTaskContextSchema),
  },
];

export async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "request_approval":
      return requestApproval(RequestApprovalSchema.parse(args));
    case "request_input":
      return requestInput(RequestInputSchema.parse(args));
    case "notify_status":
      return notifyStatus(NotifyStatusSchema.parse(args));
    case "set_task_context":
      return setTaskContext(SetTaskContextSchema.parse(args));
    default:
      return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
  }
}
