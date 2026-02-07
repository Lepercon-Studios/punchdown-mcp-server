# @lepercon-studios/punchdown-mcp-server

MCP server for **Punchdown** — mobile control plane for AI coding agents.

Get push notifications on your phone when your AI coding agent needs approval, input, or wants to share status updates. Works with **Claude Code**, **Gemini CLI**, and **OpenAI Codex**.

## Install

```bash
npm install -g @lepercon-studios/punchdown-mcp-server
```

## Configure Your Agent

### Auto-detect all installed agents

```bash
punchdown setup
```

### Or configure individually

**Claude Code:**
```bash
claude mcp add punchdown -- npx @lepercon-studios/punchdown-mcp-server
```

**Gemini CLI:**
```bash
gemini mcp add punchdown -- npx @lepercon-studios/punchdown-mcp-server
```

**Codex CLI:**
```bash
codex mcp add punchdown -- npx @lepercon-studios/punchdown-mcp-server
```

## Pair Your Device

```bash
punchdown pair
```

Scan the QR code with the Punchdown mobile app. Pairing uses Ed25519 keypair exchange — no accounts or passwords needed.

## MCP Tools

| Tool | Behavior | Returns |
|------|----------|---------|
| `request_approval` | Blocks until user approves/denies | `{ decision, user_message }` |
| `request_input` | Blocks until user provides input | `{ response }` |
| `notify_status` | Fire-and-forget | `{ delivered }` |
| `set_task_context` | Fire-and-forget | `{ updated }` |

### `request_approval`

Sends an approval request to the user's phone with action summary, details, and risk level.

### `request_input`

Asks the user a question with optional suggested responses. Blocks until answered.

### `notify_status`

Sends a status update (milestone, progress, error, complete) to the mobile dashboard.

### `set_task_context`

Updates the mobile dashboard with current task title, description, and files involved.

## Security

- **End-to-end encrypted**: All tool call content is encrypted with NaCl box before leaving your machine
- **No accounts**: Device pairing via Ed25519 keypair exchange (QR code)
- **Zero knowledge relay**: The cloud relay only routes opaque ciphertext
- **Transport security**: All connections use WSS (TLS 1.3)

## Development

```bash
git clone https://github.com/Lepercon-Studios/punchdown-mcp-server.git
cd punchdown-mcp-server
npm install
npm run build
npm run dev  # watch mode
npm test
```

## License

MIT
