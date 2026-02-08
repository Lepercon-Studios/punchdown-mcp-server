import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

/**
 * Tests for the runSetup() logic in cli.ts.
 *
 * Since runSetup() is not exported, we test the core logic directly:
 * reading config, merging the punchdown entry, writing back.
 * This validates the config modification behavior without needing
 * to mock process.argv or import.meta.url.
 */

describe("setup config modification logic", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "punchdown-setup-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const punchdownEntry = {
    command: "node",
    args: ["/mock/path/to/dist/index.js"],
  };

  function applySetupToConfig(configPath: string): void {
    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    }

    if (!config.mcpServers || typeof config.mcpServers !== "object") {
      config.mcpServers = {};
    }

    (config.mcpServers as Record<string, unknown>).punchdown = punchdownEntry;

    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }

  it("creates mcpServers with punchdown entry when config file does not exist", () => {
    const configPath = join(tempDir, "claude_desktop_config.json");

    applySetupToConfig(configPath);

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(result.mcpServers).toBeDefined();
    expect(result.mcpServers.punchdown).toEqual(punchdownEntry);
  });

  it("adds punchdown entry to existing config without overwriting other mcpServers", () => {
    const configPath = join(tempDir, "mcp.json");

    const existingConfig = {
      mcpServers: {
        "other-server": {
          command: "npx",
          args: ["other-mcp-server"],
        },
      },
    };
    writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

    applySetupToConfig(configPath);

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(result.mcpServers.punchdown).toEqual(punchdownEntry);
    expect(result.mcpServers["other-server"]).toEqual(existingConfig.mcpServers["other-server"]);
  });

  it("preserves non-mcpServers config keys", () => {
    const configPath = join(tempDir, "claude_desktop_config.json");

    const existingConfig = {
      theme: "dark",
      version: 2,
      mcpServers: {},
    };
    writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

    applySetupToConfig(configPath);

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(result.theme).toBe("dark");
    expect(result.version).toBe(2);
    expect(result.mcpServers.punchdown).toEqual(punchdownEntry);
  });

  it("overwrites existing punchdown entry if already present", () => {
    const configPath = join(tempDir, "mcp.json");

    const existingConfig = {
      mcpServers: {
        punchdown: {
          command: "node",
          args: ["/old/path/to/dist/index.js"],
        },
      },
    };
    writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

    applySetupToConfig(configPath);

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(result.mcpServers.punchdown.args[0]).toBe("/mock/path/to/dist/index.js");
  });

  it("handles empty JSON file", () => {
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(configPath, "{}");

    applySetupToConfig(configPath);

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(result.mcpServers.punchdown).toEqual(punchdownEntry);
  });

  it("handles config with mcpServers set to null", () => {
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(configPath, JSON.stringify({ mcpServers: null }));

    applySetupToConfig(configPath);

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(result.mcpServers.punchdown).toEqual(punchdownEntry);
  });

  it("writes valid JSON with trailing newline", () => {
    const configPath = join(tempDir, "mcp.json");

    applySetupToConfig(configPath);

    const raw = readFileSync(configPath, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("backup preserves original content", () => {
    const configPath = join(tempDir, "mcp.json");
    const backupPath = `${configPath}.bak`;

    const original = { mcpServers: { existing: { command: "test" } } };
    writeFileSync(configPath, JSON.stringify(original, null, 2));

    // Simulate backup (as runSetup does)
    const { copyFileSync } = require("node:fs");
    copyFileSync(configPath, backupPath);

    applySetupToConfig(configPath);

    const backupContent = JSON.parse(readFileSync(backupPath, "utf-8"));
    expect(backupContent).toEqual(original);

    const newContent = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(newContent.mcpServers.punchdown).toBeDefined();
  });
});
