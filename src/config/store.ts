// Persistent config store for device identity and pairing state

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface PunchdownConfig {
  deviceId?: string;
  keypair?: {
    publicKey: string;
    secretKey: string;
  };
  encryptionKeypair?: {
    publicKey: string;
    secretKey: string;
  };
  pairedDevices?: Array<{
    id: string;
    name: string;
    publicKey: string;
    encryptionPublicKey: string;
    pairedAt: string;
  }>;
  relayUrl?: string;
}

const CONFIG_DIR = join(homedir(), ".punchdown");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function loadConfig(): PunchdownConfig {
  try {
    const data = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(data) as PunchdownConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: PunchdownConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}
