import { describe, it, expect } from "vitest";
import {
  generateEncryptionKeypair,
  encrypt,
  decrypt,
} from "../../crypto/encryption.js";

describe("encryption", () => {
  it("generates valid keypairs", () => {
    const kp = generateEncryptionKeypair();
    expect(kp.publicKey).toBeTruthy();
    expect(kp.secretKey).toBeTruthy();
    // Base64 encoded Curve25519 keys (32 bytes)
    expect(kp.publicKey.length).toBeGreaterThan(0);
    expect(kp.secretKey.length).toBeGreaterThan(0);
  });

  it("encrypts and decrypts a message", () => {
    const sender = generateEncryptionKeypair();
    const recipient = generateEncryptionKeypair();

    const message = "Hello, secure world!";
    const { ciphertext, nonce } = encrypt(
      message,
      recipient.publicKey,
      sender.secretKey
    );

    expect(ciphertext).toBeTruthy();
    expect(nonce).toBeTruthy();
    expect(ciphertext).not.toBe(message);

    const decrypted = decrypt(
      ciphertext,
      nonce,
      sender.publicKey,
      recipient.secretKey
    );
    expect(decrypted).toBe(message);
  });

  it("fails to decrypt with wrong keys", () => {
    const sender = generateEncryptionKeypair();
    const recipient = generateEncryptionKeypair();
    const wrongRecipient = generateEncryptionKeypair();

    const message = "Secret message";
    const { ciphertext, nonce } = encrypt(
      message,
      recipient.publicKey,
      sender.secretKey
    );

    expect(() =>
      decrypt(ciphertext, nonce, sender.publicKey, wrongRecipient.secretKey)
    ).toThrow("Decryption failed");
  });

  it("handles empty string", () => {
    const sender = generateEncryptionKeypair();
    const recipient = generateEncryptionKeypair();

    const { ciphertext, nonce } = encrypt(
      "",
      recipient.publicKey,
      sender.secretKey
    );

    const decrypted = decrypt(
      ciphertext,
      nonce,
      sender.publicKey,
      recipient.secretKey
    );
    expect(decrypted).toBe("");
  });

  it("handles JSON payloads", () => {
    const sender = generateEncryptionKeypair();
    const recipient = generateEncryptionKeypair();

    const payload = JSON.stringify({
      action_summary: "Delete production database",
      risk_level: "high",
      options: ["approve", "deny"],
    });

    const { ciphertext, nonce } = encrypt(
      payload,
      recipient.publicKey,
      sender.secretKey
    );

    const decrypted = decrypt(
      ciphertext,
      nonce,
      sender.publicKey,
      recipient.secretKey
    );
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
  });

  it("produces different ciphertexts for the same message (random nonce)", () => {
    const sender = generateEncryptionKeypair();
    const recipient = generateEncryptionKeypair();

    const message = "Same message";
    const result1 = encrypt(message, recipient.publicKey, sender.secretKey);
    const result2 = encrypt(message, recipient.publicKey, sender.secretKey);

    expect(result1.ciphertext).not.toBe(result2.ciphertext);
    expect(result1.nonce).not.toBe(result2.nonce);
  });
});
