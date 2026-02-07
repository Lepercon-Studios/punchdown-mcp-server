// Ed25519 keypair management for device identity

import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

export interface DeviceKeypair {
  publicKey: string;  // base64
  secretKey: string;  // base64
}

export function generateKeypair(): DeviceKeypair {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  };
}

export function signMessage(message: Uint8Array, secretKeyBase64: string): Uint8Array {
  const secretKey = decodeBase64(secretKeyBase64);
  return nacl.sign.detached(message, secretKey);
}

export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKeyBase64: string
): boolean {
  const publicKey = decodeBase64(publicKeyBase64);
  return nacl.sign.detached.verify(message, signature, publicKey);
}
