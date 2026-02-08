import { describe, it, expect } from "vitest";
import {
  generateEncryptionKeypair,
  encrypt,
  decrypt,
} from "../../crypto/encryption.js";

/**
 * Simulates the full desktop ↔ mobile encryption roundtrip.
 *
 * Flow:
 *   1. Desktop encrypts approval request with mobile's public key
 *   2. Mobile decrypts with its own secret key
 *   3. Mobile encrypts response with desktop's public key
 *   4. Desktop decrypts with its own secret key
 *
 * Both packages (punchdown-mcp-server and app/) use identical
 * tweetnacl interfaces (Curve25519-XSalsa20-Poly1305).
 */
describe("E2E encryption roundtrip: desktop ↔ mobile", () => {
  // Generate keypairs representing both sides
  const desktop = generateEncryptionKeypair();
  const mobile = generateEncryptionKeypair();

  it("desktop sends approval request → mobile decrypts correctly", () => {
    const payload = JSON.stringify({
      action_summary: "Delete production database",
      details: "DROP TABLE users; -- affects 50k rows",
      risk_level: "high",
      options: ["approve", "deny"],
    });

    const { ciphertext, nonce } = encrypt(
      payload,
      mobile.publicKey,
      desktop.secretKey
    );

    const decrypted = decrypt(
      ciphertext,
      nonce,
      desktop.publicKey,
      mobile.secretKey
    );

    expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
  });

  it("mobile sends response → desktop decrypts correctly", () => {
    const response = JSON.stringify({
      decision: "deny",
      user_message: "Do NOT drop the production database!",
    });

    const { ciphertext, nonce } = encrypt(
      response,
      desktop.publicKey,
      mobile.secretKey
    );

    const decrypted = decrypt(
      ciphertext,
      nonce,
      mobile.publicKey,
      desktop.secretKey
    );

    expect(JSON.parse(decrypted)).toEqual(JSON.parse(response));
  });

  it("full roundtrip: request_approval → approval_response", () => {
    // Step 1: Desktop sends request_approval
    const request = JSON.stringify({
      action_summary: "Install npm package lodash@4.17.21",
      risk_level: "low",
      options: ["approve", "deny"],
    });

    const encrypted1 = encrypt(request, mobile.publicKey, desktop.secretKey);

    // Step 2: Mobile decrypts the request
    const decryptedRequest = decrypt(
      encrypted1.ciphertext,
      encrypted1.nonce,
      desktop.publicKey,
      mobile.secretKey
    );
    expect(JSON.parse(decryptedRequest)).toEqual(JSON.parse(request));

    // Step 3: Mobile encrypts its response
    const response = JSON.stringify({
      decision: "approved",
      user_message: "Go ahead",
    });
    const encrypted2 = encrypt(response, desktop.publicKey, mobile.secretKey);

    // Step 4: Desktop decrypts the response
    const decryptedResponse = decrypt(
      encrypted2.ciphertext,
      encrypted2.nonce,
      mobile.publicKey,
      desktop.secretKey
    );
    expect(JSON.parse(decryptedResponse)).toEqual(JSON.parse(response));
  });

  it("full roundtrip: request_input → input_response", () => {
    // Desktop sends request_input
    const inputRequest = JSON.stringify({
      question: "What branch should I deploy?",
      context: "We have main, staging, and feature/auth ready",
      suggestions: ["main", "staging", "feature/auth"],
    });

    const enc1 = encrypt(inputRequest, mobile.publicKey, desktop.secretKey);
    const dec1 = decrypt(
      enc1.ciphertext,
      enc1.nonce,
      desktop.publicKey,
      mobile.secretKey
    );
    expect(JSON.parse(dec1)).toEqual(JSON.parse(inputRequest));

    // Mobile responds with input
    const inputResponse = JSON.stringify({
      response: "staging",
    });
    const enc2 = encrypt(inputResponse, desktop.publicKey, mobile.secretKey);
    const dec2 = decrypt(
      enc2.ciphertext,
      enc2.nonce,
      mobile.publicKey,
      desktop.secretKey
    );
    expect(JSON.parse(dec2)).toEqual(JSON.parse(inputResponse));
  });

  it("full roundtrip: notify_status (one-way, no response)", () => {
    const status = JSON.stringify({
      event: "milestone",
      message: "Deployed v2.1.0 to staging",
      metadata: { commit: "abc123", environment: "staging" },
    });

    const enc = encrypt(status, mobile.publicKey, desktop.secretKey);
    const dec = decrypt(
      enc.ciphertext,
      enc.nonce,
      desktop.publicKey,
      mobile.secretKey
    );
    expect(JSON.parse(dec)).toEqual(JSON.parse(status));
  });

  it("full roundtrip: set_task_context payload", () => {
    const context = JSON.stringify({
      task_title: "Refactor authentication module",
      task_description: "Migrate from session-based to JWT auth",
      estimated_completion: "30 minutes",
      files_involved: ["src/auth.ts", "src/middleware.ts", "src/routes/login.ts"],
    });

    const enc = encrypt(context, mobile.publicKey, desktop.secretKey);
    const dec = decrypt(
      enc.ciphertext,
      enc.nonce,
      desktop.publicKey,
      mobile.secretKey
    );
    expect(JSON.parse(dec)).toEqual(JSON.parse(context));
  });

  describe("cross-keypair failure cases", () => {
    const thirdParty = generateEncryptionKeypair();

    it("fails when mobile tries to decrypt with wrong secret key", () => {
      const payload = JSON.stringify({ action_summary: "test" });
      const { ciphertext, nonce } = encrypt(
        payload,
        mobile.publicKey,
        desktop.secretKey
      );

      expect(() =>
        decrypt(ciphertext, nonce, desktop.publicKey, thirdParty.secretKey)
      ).toThrow("Decryption failed");
    });

    it("fails when desktop tries to decrypt response with wrong secret key", () => {
      const response = JSON.stringify({ decision: "approved" });
      const { ciphertext, nonce } = encrypt(
        response,
        desktop.publicKey,
        mobile.secretKey
      );

      expect(() =>
        decrypt(ciphertext, nonce, mobile.publicKey, thirdParty.secretKey)
      ).toThrow("Decryption failed");
    });

    it("fails when sender public key doesn't match who actually encrypted", () => {
      const payload = JSON.stringify({ action_summary: "sneaky" });
      const { ciphertext, nonce } = encrypt(
        payload,
        mobile.publicKey,
        desktop.secretKey
      );

      // Mobile tries to decrypt but is told it came from thirdParty (wrong sender)
      expect(() =>
        decrypt(ciphertext, nonce, thirdParty.publicKey, mobile.secretKey)
      ).toThrow("Decryption failed");
    });

    it("fails when ciphertext is encrypted to wrong recipient", () => {
      const payload = JSON.stringify({ action_summary: "misdirected" });
      // Desktop encrypts for thirdParty, not mobile
      const { ciphertext, nonce } = encrypt(
        payload,
        thirdParty.publicKey,
        desktop.secretKey
      );

      // Mobile cannot decrypt a message meant for someone else
      expect(() =>
        decrypt(ciphertext, nonce, desktop.publicKey, mobile.secretKey)
      ).toThrow("Decryption failed");
    });

    it("fails with tampered ciphertext", () => {
      const payload = JSON.stringify({ action_summary: "test" });
      const { ciphertext, nonce } = encrypt(
        payload,
        mobile.publicKey,
        desktop.secretKey
      );

      // Tamper with the ciphertext by flipping a character
      const tampered =
        ciphertext.charAt(0) === "A"
          ? "B" + ciphertext.slice(1)
          : "A" + ciphertext.slice(1);

      expect(() =>
        decrypt(tampered, nonce, desktop.publicKey, mobile.secretKey)
      ).toThrow("Decryption failed");
    });

    it("fails with tampered nonce", () => {
      const payload = JSON.stringify({ action_summary: "test" });
      const { ciphertext, nonce } = encrypt(
        payload,
        mobile.publicKey,
        desktop.secretKey
      );

      const tamperedNonce =
        nonce.charAt(0) === "A"
          ? "B" + nonce.slice(1)
          : "A" + nonce.slice(1);

      expect(() =>
        decrypt(ciphertext, tamperedNonce, desktop.publicKey, mobile.secretKey)
      ).toThrow("Decryption failed");
    });
  });

  describe("payload edge cases", () => {
    it("handles large JSON payloads", () => {
      const largePayload = JSON.stringify({
        action_summary: "Bulk file update",
        details: "x".repeat(10_000),
        risk_level: "medium",
        options: Array.from({ length: 100 }, (_, i) => `option-${i}`),
      });

      const enc = encrypt(largePayload, mobile.publicKey, desktop.secretKey);
      const dec = decrypt(
        enc.ciphertext,
        enc.nonce,
        desktop.publicKey,
        mobile.secretKey
      );
      expect(JSON.parse(dec)).toEqual(JSON.parse(largePayload));
    });

    it("handles unicode in payloads", () => {
      const payload = JSON.stringify({
        action_summary: "Deploy 🚀 to production 日本語テスト",
        user_message: "Approved ✅ — go ahead 你好世界",
      });

      const enc = encrypt(payload, mobile.publicKey, desktop.secretKey);
      const dec = decrypt(
        enc.ciphertext,
        enc.nonce,
        desktop.publicKey,
        mobile.secretKey
      );
      expect(JSON.parse(dec)).toEqual(JSON.parse(payload));
    });

    it("handles nested JSON objects", () => {
      const payload = JSON.stringify({
        action_summary: "Complex operation",
        metadata: {
          nested: {
            deeply: {
              value: [1, 2, { key: "val" }],
            },
          },
        },
      });

      const enc = encrypt(payload, mobile.publicKey, desktop.secretKey);
      const dec = decrypt(
        enc.ciphertext,
        enc.nonce,
        desktop.publicKey,
        mobile.secretKey
      );
      expect(JSON.parse(dec)).toEqual(JSON.parse(payload));
    });
  });

  describe("keypair independence", () => {
    it("each keypair generates unique keys", () => {
      const kp1 = generateEncryptionKeypair();
      const kp2 = generateEncryptionKeypair();

      expect(kp1.publicKey).not.toBe(kp2.publicKey);
      expect(kp1.secretKey).not.toBe(kp2.secretKey);
    });

    it("multiple concurrent sessions don't interfere", () => {
      // Simulate two separate desktop-mobile pairs
      const desktop1 = generateEncryptionKeypair();
      const mobile1 = generateEncryptionKeypair();
      const desktop2 = generateEncryptionKeypair();
      const mobile2 = generateEncryptionKeypair();

      const msg1 = "Session 1 message";
      const msg2 = "Session 2 message";

      const enc1 = encrypt(msg1, mobile1.publicKey, desktop1.secretKey);
      const enc2 = encrypt(msg2, mobile2.publicKey, desktop2.secretKey);

      // Each session can only decrypt its own messages
      expect(
        decrypt(enc1.ciphertext, enc1.nonce, desktop1.publicKey, mobile1.secretKey)
      ).toBe(msg1);
      expect(
        decrypt(enc2.ciphertext, enc2.nonce, desktop2.publicKey, mobile2.secretKey)
      ).toBe(msg2);

      // Cross-session decryption fails
      expect(() =>
        decrypt(enc1.ciphertext, enc1.nonce, desktop1.publicKey, mobile2.secretKey)
      ).toThrow("Decryption failed");
      expect(() =>
        decrypt(enc2.ciphertext, enc2.nonce, desktop2.publicKey, mobile1.secretKey)
      ).toThrow("Decryption failed");
    });
  });
});
