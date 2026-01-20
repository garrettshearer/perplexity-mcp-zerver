# Local RAG Storage Feature Specification

This document specifies the Local RAG (Retrieval-Augmented Generation) archival feature for the perplexity-mcp-zerver project.

## Goal

Create a persistent, machine-readable archive of all Perplexity interactions to serve as a knowledge base for a local RAG system (e.g., local vector DB, LangChain, LlamaIndex ingestion).

## Storage Strategy

Dual-Write Strategy:

1. Operational DB (SQLite): keep the existing runtime DB for session state and quick retrieval.
2. Archival Storage (JSONL): append every completed interaction to a structured `data/rag_archive.jsonl` file. JSON Lines is the recommended format for downstream RAG ingestion.

## Data Schema (JSONL)

File location: `./data/rag_archive.jsonl`

```ts
interface RagDocument {
  id: string;               // Unique ID for the message (UUID or ULID)
  chat_id: string;          // The Perplexity chat URL (e.g. "https://www.perplexity.ai/search/...")
  timestamp: string;        // ISO 8601
  role: "user" | "assistant";
  content: string;          // Full text
  metadata: {
    source: "perplexity-mcp-zerver";
    model?: string;         // e.g., "Sonar Pro"
    citations?: string[];   // Extracted URLs from the answer footnotes
    research_mode?: string; // "search" | "deep-research"
  }
}
```

## Integration Points

1. `SearchEngine.ts` — return `{ answer, url, citations }` from searches; extract citations and final page URL.
2. `DatabaseManager.ts` — add `archiveMessage(ragDoc: RagDocument)` to append to the JSONL archive file.
3. `chatPerplexity.ts` — after successful responses, call `archiveMessage()` for both user prompt and assistant response.

## Archiver Implementation (suggested)

- New module: `src/server/modules/RagArchiver.ts`
- Responsibilities:
  - Ensure `./data/` exists (create if missing).
  - Append newline-delimited JSON to `./data/rag_archive.jsonl` using atomic append.
  - Provide a `log(doc: RagDocument): Promise<void>` API.

Example (conceptual):

```ts
import { promises as fs } from 'fs';
import path from 'path';

const ARCHIVE_PATH = path.resolve(process.cwd(), 'data', 'rag_archive.jsonl');

export class RagArchiver {
  async ensureDir() { /* create data/ if missing */ }
  async log(doc: RagDocument) {
    const line = JSON.stringify(doc) + '\n';
    await fs.appendFile(ARCHIVE_PATH, line, { encoding: 'utf8' });
  }
}
```

## DB Schema Notes

- Store `chat_id` as TEXT (full URL) in SQLite. No need for client-generated UUIDs for chat identity.
- Continue to use a runtime numeric/UUID id for internal DB indexing if desired, but keep the Perplexity URL as the canonical chat key used for resumption.

## Backfill and Migration

- Add a migration or one-off script to rehydrate old sessions if you previously stored GUIDs and can correlate them to URLs. Otherwise, new archives will use URLs going forward.

## Testing

- Unit tests for `RagArchiver.log` to ensure correct JSONL formatting and file rotation behavior (if implemented).
- Integration test: run a search and assert a `RagDocument` entry appears with `chat_id` equal to `page.url()` returned by `SearchEngine.performSearch()`.

## Operational Concerns

- Rotation: archive file can grow unbounded; consider hourly/daily rotation or ingestion process that moves records to a vector DB and prunes the JSONL.
- Permissions: ensure the service can write to `./data/` (configurable path via env var).
- Concurrency: use appendFile (atomic on POSIX) or file locks if running multi-process.

## Example Flow

1. Client calls `chatPerplexity` with `prompt`.
2. `SearchEngine.performSearch(prompt)` runs and returns `{ answer, url, citations }`.
3. `chatPerplexity` stores messages in SQLite (session) and calls `RagArchiver.log()` twice (user and assistant messages) with `chat_id = url`.
4. Client receives `url` in response and can use it later to resume.
