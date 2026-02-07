import { z } from "zod";
import { randomUUID } from "node:crypto";
import { encrypt } from "../crypto/encryption.js";

const EncryptedPayloadSchema = z.object({
  ciphertext: z.string(),
  nonce: z.string(),
});

const MessageType = z.enum([
  "request_approval",
  "request_input",
  "notify_status",
  "set_task_context",
  "approval_response",
  "input_response",
  "ping",
  "pong",
  "error",
  "ack",
  "pairing_complete",
]);

const RelayEnvelopeSchema = z.object({
  id: z.string().uuid(),
  from: z.string(),
  to: z.string(),
  type: MessageType,
  timestamp: z.number(),
  payload: EncryptedPayloadSchema.optional(),
});

export type EncryptedPayload = z.infer<typeof EncryptedPayloadSchema>;
export type MessageTypeValue = z.infer<typeof MessageType>;
export type RelayEnvelope = z.infer<typeof RelayEnvelopeSchema>;

export { EncryptedPayloadSchema, MessageType, RelayEnvelopeSchema };

export function createEnvelope(
  from: string,
  to: string,
  type: MessageTypeValue,
  content: string,
  recipientPublicKey: string,
  senderSecretKey: string
): RelayEnvelope {
  const payload = encrypt(content, recipientPublicKey, senderSecretKey);
  return {
    id: randomUUID(),
    from,
    to,
    type,
    timestamp: Date.now(),
    payload,
  };
}

export function createPlainEnvelope(
  from: string,
  to: string,
  type: MessageTypeValue
): RelayEnvelope {
  return {
    id: randomUUID(),
    from,
    to,
    type,
    timestamp: Date.now(),
  };
}
