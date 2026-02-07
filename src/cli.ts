#!/usr/bin/env node
import { parseArgs } from "node:util";

const { positionals } = parseArgs({
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

switch (command) {
  case "pair":
    console.log("🔗 Pairing mode — QR code generation coming soon");
    // TODO: Generate keypair, display QR code, start pairing WebSocket
    break;
  case "setup":
    console.log("🔧 Setup — agent auto-detection coming soon");
    // TODO: Detect installed agents, configure MCP server
    break;
  default:
    console.log(`Punchdown MCP Server CLI

Usage:
  punchdown pair    Pair with the Punchdown mobile app
  punchdown setup   Auto-detect and configure AI coding agents
`);
}
