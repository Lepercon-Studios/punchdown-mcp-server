// QR code-based device pairing

export interface PairingPayload {
  deviceId: string;
  publicKey: string;
  relayUrl: string;
  timestamp: number;
}

export function createPairingPayload(
  deviceId: string,
  publicKey: string,
  relayUrl: string
): PairingPayload {
  return {
    deviceId,
    publicKey,
    relayUrl,
    timestamp: Date.now(),
  };
}

export async function generateQRCode(_payload: PairingPayload): Promise<string> {
  // TODO: Generate QR code string using qrcode library
  console.error("[punchdown] QR code generation stub");
  return "QR_CODE_PLACEHOLDER";
}
