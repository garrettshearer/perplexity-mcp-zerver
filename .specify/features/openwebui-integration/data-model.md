# Data Model: OpenWebUI RAG Integration

**Feature**: 001-openwebui-rag-sync  
**Date**: 2026-01-20

---

## Existing Entities (Unchanged)

### RagDocument

Source: `src/types/index.ts`

```typescript
interface RagDocument {
  id: string;              // UUID for this specific message
  chat_id: string;         // Chat/conversation identifier
  timestamp: string;       // ISO 8601 timestamp
  role: 'user' | 'assistant';
  content: string;         // The actual message content
  metadata: RagDocumentMetadata;
}

interface RagDocumentMetadata {
  source: 'perplexity-mcp-zerver';
  model?: string;
  citations?: string[];
  research_mode?: string;
}
```

---

## New Entities

### OpenWebUIConfig

Configuration for OpenWebUI connection.

```typescript
interface OpenWebUIConfig {
  /** Base URL of OpenWebUI instance */
  url: string;
  
  /** API key for authentication */
  apiKey: string;
  
  /** Knowledge base name to create/update */
  knowledgeBaseName: string;
}
```

**Validation Rules**:
- `url`: Must be valid URL format, default: `http://localhost:8090`
- `apiKey`: Required, non-empty string
- `knowledgeBaseName`: Non-empty string, default: `"Perplexity RAG Archive"`

---

### OpenWebUIFileResponse

Response from file upload endpoint.

```typescript
interface OpenWebUIFileResponse {
  /** Unique file identifier in OpenWebUI */
  id: string;
  
  /** Original filename as stored */
  filename: string;
  
  /** When the file was uploaded */
  created_at?: string;
}
```

---

### OpenWebUIFileStatus

File processing status.

```typescript
interface OpenWebUIFileStatus {
  /** Current processing state */
  status: 'pending' | 'completed' | 'failed';
  
  /** Error message if status is 'failed' */
  error?: string;
}
```

**State Transitions**:
```
pending --> completed
pending --> failed
```

---

### OpenWebUIKnowledgeBase

Knowledge base entity.

```typescript
interface OpenWebUIKnowledgeBase {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Optional description */
  description?: string;
  
  /** Creation timestamp */
  created_at?: string;
}
```

---

### SyncResult

Result of a sync operation.

```typescript
interface SyncResult {
  /** Whether sync completed successfully */
  success: boolean;
  
  /** Number of files uploaded (typically 1) */
  filesUploaded: number;
  
  /** Name of the knowledge base used */
  knowledgeBaseName: string;
  
  /** ID of the knowledge base (if successful) */
  knowledgeBaseId?: string;
  
  /** Number of records in the archive */
  recordsProcessed: number;
  
  /** Error message (if success is false) */
  error?: string;
}
```

---

### SyncState

Local state for idempotency tracking.

```typescript
interface SyncState {
  /** Timestamp of last successful sync */
  lastSyncTime: string;
  
  /** File mtime at last sync */
  lastFileMtime: string;
  
  /** Knowledge base ID from last sync */
  knowledgeBaseId: string;
  
  /** File ID from last upload */
  lastFileId: string;
}
```

**Storage**: `.sync-state.json` in archive directory

---

## Entity Relationships

```
┌─────────────────┐
│   RagDocument   │ (many)
│   (JSONL file)  │───────────┐
└─────────────────┘           │
                              │ uploaded as
                              ▼
┌─────────────────┐    ┌─────────────────┐
│ OpenWebUIConfig │───>│OpenWebUIFile    │
│   (env vars)    │    │  Response       │
└─────────────────┘    └────────┬────────┘
                               │
                               │ associated with
                               ▼
                       ┌─────────────────┐
                       │OpenWebUI        │
                       │KnowledgeBase    │
                       └─────────────────┘
                               │
                               │ produces
                               ▼
                       ┌─────────────────┐
                       │   SyncResult    │
                       └─────────────────┘
```

---

## Configuration Mapping

| Environment Variable | Config Property | Default |
|---------------------|-----------------|---------|
| `OPENWEBUI_URL` | `config.url` | `http://localhost:8090` |
| `OPENWEBUI_API_KEY` | `config.apiKey` | (required) |
| `OPENWEBUI_KB_NAME` | `config.knowledgeBaseName` | `Perplexity RAG Archive` |
