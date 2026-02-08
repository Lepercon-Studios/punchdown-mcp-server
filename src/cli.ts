#!/usr/bin/env node
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { homedir, hostname } from "node:os";
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
    relayUrl,
    hostname()
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

  // Resolve the path to dist/index.js relative to this CLI script
  const thisFile = fileURLToPath(import.meta.url);
  const distDir = dirname(thisFile);
  const serverEntryPath = join(distDir, "index.js");

  const punchdownEntry = {
    command: "node",
    args: [serverEntryPath],
  };

  const agents = [
    {
      name: "Claude Code",
      configPath: join(home, ".config", "claude", "claude_desktop_config.json"),
    },
    {
      name: "Cursor",
      configPath: join(home, ".cursor", "mcp.json"),
    },
  ];

  console.log("Punchdown MCP Server Setup\n");

  let configured = 0;
  for (const agent of agents) {
    const configDir = dirname(agent.configPath);
    const configExists = existsSync(agent.configPath);

    // Only configure agents whose config directory exists (agent is installed)
    if (!existsSync(configDir)) {
      continue;
    }

    // Read existing config or start fresh
    let config: Record<string, unknown> = {};
    if (configExists) {
      try {
        config = JSON.parse(readFileSync(agent.configPath, "utf-8"));
      } catch {
        console.log(`  Warning: Could not parse ${agent.configPath}, starting fresh`);
        config = {};
      }

      // Backup existing config
      const backupPath = `${agent.configPath}.bak`;
      copyFileSync(agent.configPath, backupPath);
      console.log(`  Backed up ${agent.configPath} -> ${backupPath}`);
    }

    // Ensure mcpServers key exists
    if (!config.mcpServers || typeof config.mcpServers !== "object") {
      config.mcpServers = {};
    }

    // Add punchdown entry
    (config.mcpServers as Record<string, unknown>).punchdown = punchdownEntry;

    // Write updated config
    mkdirSync(configDir, { recursive: true });
    writeFileSync(agent.configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

    console.log(`  Configured ${agent.name}: ${agent.configPath}`);
    configured++;
  }

  if (configured === 0) {
    console.log("  No known agents detected.");
    console.log("  To add manually, use: punchdown-mcp-server as an MCP stdio server\n");
  } else {
    console.log(`\n  Done! Configured ${configured} agent(s).`);
    console.log(`  MCP server entry: node ${serverEntryPath}\n`);
  }
}
