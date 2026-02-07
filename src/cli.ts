#!/usr/bin/env node
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, saveConfig } from "./config/store.js";
import { generateKeypair } from "./auth/keypair.js";
import { generateEncryptionKeypair } from "./crypto/encryption.js";
import { createPairingPayload, generateQRCode } from "./auth/pairing.js";
import { createAuthToken } from "./auth/tokens.js";
import WebSocket from "ws";

const { positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

const DEFAULT_RELAY_URL = "http://localhost:3002";

switch (command) {
  case "pair":
    await runPair();
    break;
  case "setup":
    runSetup();
    break;
  default:
    console.log(`Punchdown MCP Server CLI

Usage:
  punchdown pair    Pair with the Punchdown mobile app
  punchdown setup   Auto-detect and configure AI coding agents
`);
}

async function runPair(): Promise<void> {
  let config = loadConfig();

  // Generate or load device identity
  if (!config.deviceId) {
    config.deviceId = randomUUID();
  }
  if (!config.keypair) {
    config.keypair = generateKeypair();
  }
  if (!config.encryptionKeypair) {
    config.encryptionKeypair = generateEncryptionKeypair();
  }
  const relayUrl = config.relayUrl ?? DEFAULT_RELAY_URL;
  config.relayUrl = relayUrl;
  saveConfig(config);

  console.log(`Device ID: ${config.deviceId}`);
  console.log(`Relay URL: ${relayUrl}`);

  // Call relay /api/pair/initiate
  const initResponse = await fetch(`${relayUrl}/api/pair/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: config.deviceId,
      publicKey: config.keypair.publicKey,
      encryptionPublicKey: config.encryptionKeypair.publicKey,
      deviceType: "desktop",
    }),
  });

  if (!initResponse.ok) {
    console.error("Failed to initiate pairing:", await initResponse.text());
    process.exit(1);
  }

  const { pairingId, expiresAt } = (await initResponse.json()) as {
    pairingId: string;
    expiresAt: string;
  };

  console.log(`\nPairing ID: ${pairingId}`);
  console.log(`Expires: ${expiresAt}\n`);

  // Generate QR code containing the pairing info
  const payload = createPairingPayload(
    config.deviceId,
    config.keypair.publicKey,
    config.encryptionKeypair.publicKey,
    relayUrl
  );
  // Include the pairingId in the QR data
  const qrData = { ...payload, pairingId };
  const qr = await generateQRCode(qrData as Parameters<typeof generateQRCode>[0]);
  console.log("Scan this QR code with the Punchdown mobile app:\n");
  console.log(qr);

  // Connect via WebSocket and wait for pairing_complete
  const wsUrl = relayUrl.replace(/^http/, "ws");
  const authToken = createAuthToken(config.deviceId, "desktop", config.keypair.secretKey);

  const ws = new WebSocket(
    `${wsUrl}/ws/device?token=${encodeURIComponent(authToken)}`
  );

  const timeout = setTimeout(() => {
    console.log("\nPairing timed out. Please try again.");
    ws.close();
    process.exit(1);
  }, 5 * 60 * 1000);

  ws.on("open", () => {
    console.log("Waiting for mobile device to scan QR code...\n");
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "pairing_complete") {
        clearTimeout(timeout);
        console.log("Paired successfully!");

        // Save the paired mobile device info
        const pairedDevice = msg.pairedDevice ?? {};
        config = loadConfig();
        config.pairedDevices = config.pairedDevices ?? [];
        config.pairedDevices.push({
          id: pairedDevice.deviceId ?? "unknown",
          name: pairedDevice.name ?? "Mobile Device",
          publicKey: pairedDevice.publicKey ?? "",
          encryptionPublicKey: pairedDevice.encryptionPublicKey ?? "",
          pairedAt: new Date().toISOString(),
        });
        saveConfig(config);
        console.log("Device configuration saved.");
        ws.close();
        process.exit(0);
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
    clearTimeout(timeout);
    process.exit(1);
  });

  ws.on("close", () => {
    clearTimeout(timeout);
  });
}

function runSetup(): void {
  const home = homedir();

  const agents = [
    {
      name: "Claude Code",
      configPath: join(
        home,
        ".config",
        "claude",
        "claude_desktop_config.json"
      ),
      addCommand:
        "claude mcp add punchdown -- node /path/to/punchdown-mcp-server/dist/index.js",
    },
    {
      name: "Cursor",
      configPath: join(home, ".cursor", "mcp.json"),
      addCommand:
        'Add to .cursor/mcp.json: {"mcpServers":{"punchdown":{"command":"node","args":["/path/to/punchdown-mcp-server/dist/index.js"]}}}',
    },
  ];

  console.log("Detected AI coding agents:\n");
  let found = false;
  for (const agent of agents) {
    if (existsSync(agent.configPath)) {
      console.log(`  * ${agent.name}`);
      console.log(`    ${agent.addCommand}\n`);
      found = true;
    }
  }
  if (!found) {
    console.log("  No known agents detected.");
    console.log(
      "  To add manually, use: punchdown-mcp-server as an MCP stdio server\n"
    );
  }
}
