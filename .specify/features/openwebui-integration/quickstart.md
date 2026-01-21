# Quickstart: OpenWebUI RAG Integration

## Prerequisites

1. **OpenWebUI running** at `http://localhost:8090` (or custom URL)
2. **API key** from OpenWebUI Settings → Account → API Key
3. **RAG archive** populated via Perplexity MCP usage

## Setup

```bash
# Set required environment variable
export OPENWEBUI_API_KEY="your-api-key-here"

# Optional: Custom OpenWebUI URL (default: http://localhost:8090)
export OPENWEBUI_URL="http://your-openwebui-server:8090"

# Optional: Custom knowledge base name (default: "Perplexity RAG Archive")
export OPENWEBUI_KB_NAME="My Custom KB Name"
```

## Usage

```bash
# Run sync manually
pnpm sync:openwebui
```

## Expected Output

```
[2026-01-20T10:30:00.000Z] [INFO] Starting OpenWebUI RAG sync...
[2026-01-20T10:30:00.100Z] [INFO] Uploading rag_archive.jsonl (523 records)...
[2026-01-20T10:30:01.500Z] [INFO] Waiting for processing...
[2026-01-20T10:30:15.000Z] [INFO] Processing completed
[2026-01-20T10:30:15.200Z] [INFO] Sync completed successfully!
[2026-01-20T10:30:15.200Z] [INFO]   Knowledge Base: Perplexity RAG Archive
[2026-01-20T10:30:15.200Z] [INFO]   Files Uploaded: 1
[2026-01-20T10:30:15.200Z] [INFO]   Records Processed: 523
```

## Troubleshooting

### "OPENWEBUI_API_KEY is not set"
Set the environment variable with your API key from OpenWebUI.

### "Connection refused"
Ensure OpenWebUI is running and accessible at the configured URL.

### "401 Unauthorized"
Your API key is invalid or expired. Generate a new one in OpenWebUI.

### "Processing timed out"
Large archives may take longer. Check OpenWebUI logs for processing status.
