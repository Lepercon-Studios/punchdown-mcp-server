import { describe, it, expect } from "vitest";
import { createPairingPayload } from "../../auth/pairing.js";

describe("createPairingPayload", () => {
  const deviceId = "test-device-id";
  const publicKey = "dGVzdC1wdWJsaWMta2V5";
  const encryptionPublicKey = "dGVzdC1lbmMta2V5";
  const relayUrl = "https://relay.punchdown.dev";
  const deviceName = "Test-MacBook.local";

  it("includes deviceName in the payload", () => {
    const payload = createPairingPayload(
      deviceId,
      publicKey,
      encryptionPublicKey,
      relayUrl,
      deviceName
    );

    expect(payload.deviceName).toBe(deviceName);
  });

  it("includes all required fields", () => {
    const payload = createPairingPayload(
      deviceId,
      publicKey,
      encryptionPublicKey,
      relayUrl,
      deviceName
    );

    expect(payload.deviceId).toBe(deviceId);
    expect(payload.publicKey).toBe(publicKey);
    expect(payload.encryptionPublicKey).toBe(encryptionPublicKey);
    expect(payload.relayUrl).toBe(relayUrl);
    expect(payload.deviceName).toBe(deviceName);
    expect(typeof payload.timestamp).toBe("number");
  });

  it("generates a timestamp close to now", () => {
    const before = Date.now();
    const payload = createPairingPayload(
      deviceId,
      publicKey,
      encryptionPublicKey,
      relayUrl,
      deviceName
    );
    const after = Date.now();

    expect(payload.timestamp).toBeGreaterThanOrEqual(before);
    expect(payload.timestamp).toBeLessThanOrEqual(after);
  });

  it("produces valid JSON for QR code generation", () => {
    const payload = createPairingPayload(
      deviceId,
      publicKey,
      encryptionPublicKey,
      relayUrl,
      deviceName
    );

    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);

    expect(parsed.deviceId).toBe(deviceId);
    expect(parsed.deviceName).toBe(deviceName);
    expect(parsed.relayUrl).toBe(relayUrl);
  });

  it("QR data with pairingId spread includes deviceName", () => {
    const payload = createPairingPayload(
      deviceId,
      publicKey,
      encryptionPublicKey,
      relayUrl,
      deviceName
    );

    // This mirrors the cli.ts spread: { ...payload, pairingId }
    const qrData = { ...payload, pairingId: "pair-123" };

    expect(qrData.deviceName).toBe(deviceName);
    expect(qrData.pairingId).toBe("pair-123");
    expect(qrData.relayUrl).toBe(relayUrl);
  });
});
