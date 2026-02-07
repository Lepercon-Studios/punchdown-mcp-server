import QRCode from "qrcode";

export interface PairingPayload {
  deviceId: string;
  publicKey: string;
  encryptionPublicKey: string;
  relayUrl: string;
  timestamp: number;
}

export function createPairingPayload(
  deviceId: string,
  publicKey: string,
  encryptionPublicKey: string,
  relayUrl: string
): PairingPayload {
  return {
    deviceId,
    publicKey,
    encryptionPublicKey,
    relayUrl,
    timestamp: Date.now(),
  };
}

export async function generateQRCode(payload: PairingPayload): Promise<string> {
  const data = JSON.stringify(payload);
  return QRCode.toString(data, { type: "terminal", small: true });
}
