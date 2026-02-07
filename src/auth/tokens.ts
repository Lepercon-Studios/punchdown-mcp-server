import nacl from "tweetnacl";
import { encodeBase64, decodeBase64, decodeUTF8 } from "tweetnacl-util";

export function createAuthToken(
  deviceId: string,
  deviceType: "desktop" | "mobile",
  secretKey: string
): string {
  const payload = JSON.stringify({
    deviceId,
    deviceType,
    timestamp: Date.now(),
    nonce: encodeBase64(nacl.randomBytes(16)),
  });
  const payloadBytes = decodeUTF8(payload);
  const signature = nacl.sign.detached(payloadBytes, decodeBase64(secretKey));
  return `${encodeBase64(signature)}.${encodeBase64(payloadBytes)}`;
}
