# OpenWebUI Sync API Contract

**Version**: 1.0  
**Base URL**: `{OPENWEBUI_URL}/api/v1`  
**Auth**: Bearer token in `Authorization` header
USE OpenWebUI JWT TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxZTdkZWIwLTk3ZGItNGQyMC1iNDEyLWVkODRmOGZkYjhkMiIsImV4cCI6MTc3MDUyOTYxNn0.nHbAk0PQnQBxzq9vSmySUWjeYLPoD2A0KSE5ZZ_0p1c

OR API KEY: sk-f0a8644b578143119918f46635fc1201
---

## Endpoints

### 1. Upload File

```http
POST /files/
Content-Type: multipart/form-data
Authorization: Bearer {OPENWEBUI_API_KEY}

file: (binary)
```

**Query Parameters**:
- `process=true` (default) - Enable content extraction
- `process_in_background=true` (default) - Async processing

**Response 200**:
```json
{
  "id": "file-uuid-here",
  "filename": "rag_archive.jsonl",
  "created_at": "2026-01-20T10:30:00Z"
}
```

**Error Responses**:
- `401`: Invalid or missing API key
- `413`: File too large
- `500`: Server error

---

### 2. Get Processing Status

```http
GET /files/{file_id}/process/status
Authorization: Bearer {OPENWEBUI_API_KEY}
```

**Response 200 (Pending)**:
```json
{
  "status": "pending"
}
```

**Response 200 (Completed)**:
```json
{
  "status": "completed"
}
```

**Response 200 (Failed)**:
```json
{
  "status": "failed",
  "error": "Processing error description"
}
```

---

### 3. List Knowledge Bases

```http
GET /knowledge/
Authorization: Bearer {OPENWEBUI_API_KEY}
```

**Response 200**:
```json
[
  {
    "id": "kb-uuid-1",
    "name": "Perplexity RAG Archive",
    "description": "Synced from perplexity-mcp-zerver",
    "created_at": "2026-01-15T08:00:00Z"
  },
  {
    "id": "kb-uuid-2",
    "name": "Other KB",
    "description": null,
    "created_at": "2026-01-10T12:00:00Z"
  }
]
```

---

### 4. Create Knowledge Base

```http
POST /knowledge/create
Content-Type: application/json
Authorization: Bearer {OPENWEBUI_API_KEY}

{
  "name": "Perplexity RAG Archive",
  "description": "Synced from perplexity-mcp-zerver"
}
```

**Response 200**:
```json
{
  "id": "kb-new-uuid",
  "name": "Perplexity RAG Archive",
  "description": "Synced from perplexity-mcp-zerver",
  "created_at": "2026-01-20T10:35:00Z"
}
```

**Error Responses**:
- `400`: Missing required field (name)
- `409`: Knowledge base with name already exists

---

### 5. Add File to Knowledge Base

```http
POST /knowledge/{knowledge_id}/file/add
Content-Type: application/json
Authorization: Bearer {OPENWEBUI_API_KEY}

{
  "file_id": "file-uuid-here"
}
```

**Response 200**:
```json
{
  "success": true
}
```

**Error Responses**:
- `404`: Knowledge base or file not found
- `409`: File already associated with this knowledge base

---

## Error Response Format

All error responses follow this structure:

```json
{
  "detail": "Human-readable error message"
}
```

---

## Rate Limits

OpenWebUI does not enforce rate limits by default. However, file processing is resource-intensive:
- Recommend max 1 sync per minute
- Large files (>50MB) may timeout

---

## Notes

1. File processing time depends on file size and server resources
2. Processing timeout should be at least 5 minutes for large archives
3. Knowledge base names are case-sensitive
4. Deleted files are not automatically removed from knowledge bases
