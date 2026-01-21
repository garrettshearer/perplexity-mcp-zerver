# Research: OpenWebUI RAG Integration

**Feature**: 001-openwebui-rag-sync  
**Date**: 2026-01-20

---

## API Research

### Decision: Use OpenWebUI REST API v1

**Rationale**: OpenWebUI provides a well-documented REST API at `/api/v1/` that supports all required operations:
- File upload with automatic processing
- Knowledge base CRUD operations
- File-to-knowledge association

**Alternatives Considered**:
1. **Direct database access** - Rejected: Would bypass processing pipeline and security
2. **WebSocket streaming** - Rejected: Overkill for sync use case
3. **gRPC** - Not available in OpenWebUI

### Decision: Use Polling for Processing Status

**Rationale**: OpenWebUI processes files asynchronously. The `/api/v1/files/{id}/process/status` endpoint supports both polling and streaming. Polling is simpler and more reliable for CLI tools.

**Alternatives Considered**:
1. **Server-Sent Events** - Available but adds complexity
2. **Webhook callbacks** - Not supported by OpenWebUI
3. **Assume instant processing** - Rejected: Would cause failures

### Decision: Store Sync State Locally

**Rationale**: To enable idempotent sync (skip if unchanged), we need to track last sync timestamp. A simple `.sync-state.json` file alongside the archive is sufficient.

**Alternatives Considered**:
1. **File hash comparison** - More accurate but expensive for large files
2. **OpenWebUI-side tracking** - Not supported
3. **Environment variable** - Not persistent

---

## Authentication Research

### Decision: Bearer Token via Environment Variable

**Rationale**: OpenWebUI uses JWT-based API keys. Storing in `OPENWEBUI_API_KEY` env var follows security best practices and matches existing patterns in the codebase (see `PERPLEXITY_*` vars).

**Token Acquisition**:
1. User logs into OpenWebUI
2. Navigate to Settings → Account
3. Click "Generate API Key"
4. Copy and set as `OPENWEBUI_API_KEY`

---

## File Format Research

### Decision: Upload JSONL Directly

**Rationale**: OpenWebUI's knowledge processing pipeline accepts JSONL files and extracts content automatically. No pre-processing needed.

**JSONL Structure** (existing):
```json
{"id":"uuid","chat_id":"string","timestamp":"iso8601","role":"user|assistant","content":"string","metadata":{...}}
```

OpenWebUI will:
1. Parse each JSON line
2. Extract `content` field for embedding
3. Store metadata for retrieval

---

## Error Handling Research

### Decision: Exponential Backoff with 3 Retries

**Rationale**: Industry standard for handling transient network failures. Matches pattern used in puppeteer-logic.ts.

**Backoff Schedule**:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 second delay
- Attempt 4: 4 second delay
- After 4 failures: Give up, report error

**Retriable Errors**:
- 5xx server errors
- Network timeouts
- Connection refused (OpenWebUI starting up)

**Non-Retriable Errors**:
- 401 Unauthorized (bad API key)
- 404 Not Found (endpoint doesn't exist)
- 400 Bad Request (malformed data)

---

## Technology Stack Confirmation

| Component | Choice | Existing in Project |
|-----------|--------|---------------------|
| HTTP Client | axios | ✅ Yes (v1.10.0) |
| File I/O | node:fs/promises | ✅ Yes |
| JSON Parsing | Built-in | ✅ Yes |
| Logging | logging.ts | ✅ Yes |
| Testing | Vitest | ✅ Yes |

No new dependencies required.
