# Perplexity MCP Zerver

A minimalist research server implementing the Model Context Protocol (MCP) to deliver AI-powered research capabilities through Perplexity's web interface.

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-333)]()
[![TypeScript Codebase](https://img.shields.io/badge/TypeScript-Codebase-333)]()
[![Tests Passing](https://img.shields.io/badge/Tests-Passing-333)]()
[![Bun Runtime](https://img.shields.io/badge/Runtime-Bun-333)]()

## Research Capabilities

- **Intelligent Web Research**: Search and summarize content without API limits
- **Persistent Conversations**: Maintain context with local SQLite chat storage
- **Content Extraction**: Clean article extraction with GitHub repository parsing
- **Developer Tooling**: Documentation retrieval, API discovery, code analysis
- **Keyless Operation**: Browser automation replaces API key requirements

---

## Available Tools

### Search (`search`)
Perform research queries with configurable depth  
*Returns raw text results*

### Get Documentation (`get_documentation`)
Retrieve technical documentation with examples  
*Returns structured documentation*

### Find APIs (`find_apis`)
Discover relevant APIs for development needs  
*Returns API listings and descriptions*

### Check Deprecated Code (`check_deprecated_code`)
Analyze code snippets for outdated patterns  
*Returns analysis report*

### Extract URL Content (`extract_url_content`)
Parse web content with automatic GitHub handling  
*Returns structured content metadata*

### Chat (`chat_perplexity`)
Persistent conversations with context history  
*Returns conversation state in JSON format*

---

## Model Switching

Switch between AI models (Claude, GPT-4o, Sonar, etc.) when making queries. Works with both `search` and `chat_perplexity` tools.

### Usage Examples

**Specify a model for search:**
```json
{
  "tool": "search",
  "arguments": {
    "query": "Explain quantum computing",
    "model": "Claude 3.5 Sonnet"
  }
}
```

**Specify a model for chat:**
```json
{
  "tool": "chat_perplexity",
  "arguments": {
    "message": "What are the benefits of TypeScript?",
    "model": "GPT-4o"
  }
}
```

### Supported Features

- **Case-insensitive matching**: `"claude"`, `"Claude"`, `"CLAUDE"` all work
- **Partial matching**: `"Claude"` matches `"Claude 3.5 Sonnet"`
- **Default behavior**: Omit `model` to use currently selected model
- **Clear errors**: Invalid model names return available options

### Available Models

Models depend on your Perplexity account:
- **Free**: Sonar, Sonar Large
- **Pro**: Claude 3.5 Sonnet, GPT-4o, Gemini, and more

---

## Getting Started

### Prerequisites
- Bun runtime
- Node.js 18+ (for TypeScript compilation)

### Installation
```bash
git clone https://github.com/wysh3/perplexity-mcp-zerver.git
cd perplexity-mcp-zerver
bun install
bun run build
```

### Configuration
Add to your MCP configuration file:
```json
{
  "mcpServers": {
    "perplexity-server": {
      "command": "bun",
      "args": ["/absolute/path/to/build/main.js"],
      "timeout": 300
    }
  }
}
```

### Usage
Initiate commands through your MCP client:
- "Use perplexity to research quantum computing advancements"
- "Ask perplexity-server for React 18 documentation"
- "Begin conversation with perplexity about neural networks"

---

## 🔐 Pro Account Support (Optional)

Use your Perplexity Pro subscription for access to better models (GPT-5.1, Claude Sonnet 4.5) and higher limits.

### One-Time Setup
```bash
bun run build
bun run login
```

A browser window will open. **Log in using email** (recommended for best compatibility), then close the browser. Your session is now saved!

> **Note**: Google/SSO login may work but email login is more reliable with the browser automation.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PERPLEXITY_BROWSER_DATA_DIR` | `~/.perplexity-mcp` | Browser profile directory |
| `PERPLEXITY_PERSISTENT_PROFILE` | `true` | Set to `false` for anonymous mode |
| `PERPLEXITY_HEADLESS` | `true` | Set to `false` for visible browser (debugging) |
| `RAG_ARCHIVE_PATH` | `./data/rag_archive.jsonl` | Path to JSONL file for RAG storage |

### Local RAG Storage

All Perplexity interactions are automatically archived to a local JSONL file for downstream RAG pipelines. Each interaction creates two entries: one for the user message and one for the assistant response.

**Archive Format (JSONL)**:
```json
{"id":"uuid","chat_id":"perplexity-url","timestamp":"2026-01-20T12:00:00.000Z","role":"user","content":"user message","metadata":{"source":"perplexity-mcp-zerver"}}
{"id":"uuid","chat_id":"perplexity-url","timestamp":"2026-01-20T12:00:01.000Z","role":"assistant","content":"response","metadata":{"source":"perplexity-mcp-zerver","model":"claude-3","research_mode":"search"}}
```

**Custom Archive Location**:
```bash
RAG_ARCHIVE_PATH=/custom/path/archive.jsonl bun run start
```

**Query Archives with jq**:
```bash
# All entries
jq -c '.' ./data/rag_archive.jsonl

# Only assistant responses
jq -c 'select(.role == "assistant")' ./data/rag_archive.jsonl

# Entries from a specific chat
jq -c 'select(.chat_id | contains("abc123"))' ./data/rag_archive.jsonl
```

### OpenWebUI RAG Sync

Sync your local RAG archive to an OpenWebUI knowledge base for enhanced retrieval capabilities.

**Prerequisites**:
- OpenWebUI instance running (default: `http://localhost:8090`)
- OpenWebUI API key (Settings → Account → API Key)

**Environment Variables**:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENWEBUI_URL` | `http://localhost:8090` | OpenWebUI instance URL |
| `OPENWEBUI_API_KEY` | *(required)* | API key for authentication |
| `OPENWEBUI_KB_NAME` | `Perplexity RAG Archive` | Knowledge base name to create/update |

**Sync Command**:
```bash
# Set your API key
export OPENWEBUI_API_KEY="your-api-key-here"

# Run sync
pnpm sync:openwebui

# With verbose output
pnpm sync:openwebui --verbose
```

**Features**:
- **Idempotent**: Skips upload if archive hasn't changed since last sync
- **Auto-retry**: Exponential backoff for transient errors (1s, 2s, 4s)
- **Clear errors**: Actionable messages for common issues (auth, connection, timeout)
- **Progress logging**: Status updates to stderr

**Output**:
```
Starting OpenWebUI RAG sync...
  Archive: ./data/rag_archive.jsonl
  Target: http://localhost:8090
  Knowledge Base: Perplexity RAG Archive
Uploading file: rag_archive.jsonl
Waiting for file processing...
File processing completed
Found existing knowledge base: Perplexity RAG Archive
Adding file to knowledge base...
File added to knowledge base successfully
Sync completed successfully!
  Knowledge Base: Perplexity RAG Archive
  Knowledge Base ID: kb-abc123
  Files Uploaded: 1
  Records Processed: 42
```

### Debugging with Visible Browser

For debugging browser automation issues or demos, run with a visible browser window:

```bash
PERPLEXITY_HEADLESS=false bun run start
```

This shows the browser window during operations, helpful for:
- Troubleshooting Cloudflare challenges
- Verifying login state  
- Debugging selector issues
- Live demonstrations

---

## Technical Comparison

| Feature              | This Implementation | Traditional APIs |
|----------------------|---------------------|------------------|
| Authentication       | None required       | API keys         |
| Cost                 | Free                | Usage-based      |
| Data Privacy         | Local processing    | Remote servers   |
| GitHub Integration   | Native support      | Limited          |
| History Persistence  | SQLite storage      | Session-based    |

---

## Troubleshooting

**Server Connection Issues**
1. Verify absolute path in configuration
2. Confirm Node.js installation with `node -v`
3. Ensure build completed successfully

**Content Extraction**
- GitHub paths must use full repository URLs
- Adjust link recursion depth in source configuration

---

## Origins & License
 
based on - [DaInfernalCoder/perplexity-researcher-mcp](https://github.com/DaInfernalCoder/perplexity-researcher-mcp)  
refactored from - [sm-moshi/docshunter](https://github.com/sm-moshi/docshunter)  

Licensed under **GNU GPL v3.0** - [View License](LICENSE)

---

> This project interfaces with Perplexity via browser automation. Use responsibly and ethically. Stability depends on Perplexity's website consistency. Educational use only.
