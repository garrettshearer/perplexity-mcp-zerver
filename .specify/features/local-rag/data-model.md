# Data Model: Local RAG Storage

**Feature**: Local RAG Storage  
**Date**: 2026-01-20  
**Spec Reference**: [spec.md](./spec.md)

## Entity: RagDocument

The primary entity representing a single message (user or assistant) archived from a Perplexity interaction.

### Schema Definition

```typescript
/**
 * RagDocument - Archive record for a single Perplexity message
 * 
 * Designed for compatibility with:
 * - LangChain JSONLoader / JSONLinesLoader
 * - LlamaIndex JSONReader
 * - OpenWebUI import
 * - Perplexica knowledge base
 * 
 * @see FR-001 through FR-017 in spec.md
 */
export interface RagDocument {
  /**
   * Unique identifier for this message
   * @format RFC 4122 UUID v4
   * @example "550e8400-e29b-41d4-a716-446655440000"
   * @required
   * @see FR-017
   */
  id: string;
  
  /**
   * Full Perplexity URL identifying the conversation
   * Used to link user prompts with assistant responses
   * @format URL (https://www.perplexity.ai/search/...)
   * @example "https://www.perplexity.ai/search/quantum-computing-abc123"
   * @required
   * @see FR-006
   */
  chat_id: string;
  
  /**
   * When this message was recorded
   * @format ISO 8601 datetime with timezone
   * @example "2026-01-20T14:30:00.000Z"
   * @required
   * @see FR-007
   */
  timestamp: string;
  
  /**
   * Who generated this message
   * @enum "user" | "assistant"
   * @required
   * @see FR-008
   */
  role: "user" | "assistant";
  
  /**
   * Full text content of the message
   * For user: the original prompt
   * For assistant: the complete Perplexity response
   * @required
   * @see FR-001, FR-002
   */
  content: string;
  
  /**
   * Additional context and provenance information
   * @required
   * @see FR-009 through FR-012
   */
  metadata: RagDocumentMetadata;
}
```

### Metadata Schema

```typescript
/**
 * RagDocumentMetadata - Additional context for RAG retrieval
 */
export interface RagDocumentMetadata {
  /**
   * Origin identifier for this document
   * Always "perplexity-mcp-zerver" for documents from this server
   * @constant "perplexity-mcp-zerver"
   * @required
   * @see FR-009
   */
  source: "perplexity-mcp-zerver";
  
  /**
   * AI model used for this interaction
   * Only present when explicitly specified by user
   * @example "Claude 3.5 Sonnet", "GPT-4o"
   * @optional
   * @see FR-011
   */
  model?: string;
  
  /**
   * Research mode used for the search
   * @enum "search" | "deep-research"
   * @optional
   * @see FR-012
   */
  research_mode?: "search" | "deep-research";
  
  /**
   * Citation URLs from the assistant response
   * Only present for role="assistant" when citations available
   * @format Array of valid URLs
   * @example ["https://en.wikipedia.org/wiki/Quantum_computing"]
   * @optional
   * @see FR-010
   */
  citations?: string[];
}
```

## Validation Rules

| Field | Rule | Error Behavior |
|-------|------|----------------|
| `id` | Must be valid UUID v4 format | Generate new UUID if missing |
| `chat_id` | Must start with `https://www.perplexity.ai/` | Log warning, use placeholder |
| `timestamp` | Must be valid ISO 8601 datetime | Use current time if invalid |
| `role` | Must be exactly "user" or "assistant" | Reject document |
| `content` | Must be non-empty string | Log warning, use empty string |
| `metadata.source` | Must be "perplexity-mcp-zerver" | Auto-set if missing |
| `metadata.citations` | Must be array of valid URLs | Filter invalid URLs |

## State Transitions

RagDocument is append-only and immutable. No state transitions occur after creation.

```
[Search Request] 
    → Create RagDocument (role=user)
    → Append to JSONL

[Search Response]
    → Create RagDocument (role=assistant)
    → Append to JSONL
```

## Relationships

```
┌─────────────────────┐
│    Perplexity       │
│    Interaction      │
└─────────┬───────────┘
          │ 1
          │
          │ produces
          │
          ▼ 2
┌─────────────────────┐
│    RagDocument      │ × 2 per interaction
│    (user + asst)    │
└─────────────────────┘
          │
          │ grouped by
          │
          ▼
┌─────────────────────┐
│    chat_id (URL)    │
└─────────────────────┘
```

## Example Documents

### User Message

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "chat_id": "https://www.perplexity.ai/search/quantum-computing-abc123",
  "timestamp": "2026-01-20T14:30:00.000Z",
  "role": "user",
  "content": "What is quantum computing and how does it differ from classical computing?",
  "metadata": {
    "source": "perplexity-mcp-zerver"
  }
}
```

### Assistant Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "chat_id": "https://www.perplexity.ai/search/quantum-computing-abc123",
  "timestamp": "2026-01-20T14:30:05.123Z",
  "role": "assistant",
  "content": "Quantum computing is a revolutionary approach to computation that leverages quantum mechanical phenomena like superposition and entanglement...",
  "metadata": {
    "source": "perplexity-mcp-zerver",
    "model": "Claude 3.5 Sonnet",
    "research_mode": "search",
    "citations": [
      "https://en.wikipedia.org/wiki/Quantum_computing",
      "https://www.ibm.com/quantum/what-is-quantum-computing",
      "https://www.nature.com/articles/s41586-023-06096-3"
    ]
  }
}
```

## JSONL File Format

Documents are stored one per line in JSONL (JSON Lines) format:

```jsonl
{"id":"550e8400-e29b-41d4-a716-446655440000","chat_id":"https://www.perplexity.ai/search/quantum-computing-abc123","timestamp":"2026-01-20T14:30:00.000Z","role":"user","content":"What is quantum computing?","metadata":{"source":"perplexity-mcp-zerver"}}
{"id":"550e8400-e29b-41d4-a716-446655440001","chat_id":"https://www.perplexity.ai/search/quantum-computing-abc123","timestamp":"2026-01-20T14:30:05.123Z","role":"assistant","content":"Quantum computing is...","metadata":{"source":"perplexity-mcp-zerver","citations":["https://en.wikipedia.org/wiki/Quantum_computing"]}}
```

**Properties**:
- One JSON object per line
- Newline-delimited (`\n`)
- No trailing commas
- UTF-8 encoded
- No BOM (Byte Order Mark)

## Downstream Compatibility

### LangChain

```python
from langchain_community.document_loaders import JSONLoader

loader = JSONLoader(
    file_path="./data/rag_archive.jsonl",
    jq_schema=".",
    json_lines=True,
    content_key="content",
    metadata_func=lambda record, metadata: {
        **metadata,
        "source": record.get("metadata", {}).get("source"),
        "chat_id": record.get("chat_id"),
        "role": record.get("role"),
    }
)
docs = loader.load()
```

### LlamaIndex

```python
from llama_index.readers.json import JSONReader

reader = JSONReader()
documents = reader.load_data(
    input_file="./data/rag_archive.jsonl",
    extra_info={"source": "perplexity-mcp-zerver"}
)
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-20
