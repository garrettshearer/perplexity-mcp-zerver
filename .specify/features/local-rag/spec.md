# Feature Specification: Local RAG Storage

**Feature Branch**: `local-rag`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Local RAG Storage - persistent JSONL archive of all Perplexity interactions for local RAG systems"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Archive Perplexity Interactions Automatically (Priority: P1)

As a developer building local AI applications, I want all my Perplexity interactions to be automatically archived to a JSONL file so that I can ingest them into my local RAG system (vector DB, LangChain, LlamaIndex, OpenWebUI, Perplexica) without manual export steps.

**Why this priority**: This is the core value proposition—without automatic archival, users cannot build local knowledge bases from their Perplexity interactions.

**Independent Test**: Can be fully tested by making a single Perplexity search and verifying a valid JSONL entry appears in the archive file with correct structure.

**Acceptance Scenarios**:

1. **Given** the MCP server is running with default configuration, **When** a user executes a `chat_perplexity` tool call, **Then** both the user prompt and assistant response are appended to `./data/rag_archive.jsonl` with valid `RagDocument` schema.

2. **Given** the archive file does not exist, **When** the first interaction occurs, **Then** the system creates the `./data/` directory and `rag_archive.jsonl` file automatically.

3. **Given** an interaction completes successfully, **When** the archive entry is written, **Then** the `chat_id` field contains the full Perplexity URL (e.g., `https://www.perplexity.ai/search/...`).

---

### User Story 2 - Configure Archive Location (Priority: P2)

As a system administrator, I want to configure the archive file location via environment variable so that I can store the RAG archive in a location that fits my deployment (e.g., mounted volume, shared storage, backup directory).

**Why this priority**: Different deployment environments require flexible storage paths, but the default path works for most users.

**Independent Test**: Can be tested by setting `RAG_ARCHIVE_PATH` environment variable and verifying archives write to the specified location.

**Acceptance Scenarios**:

1. **Given** `RAG_ARCHIVE_PATH=/custom/path/archive.jsonl` is set, **When** an interaction occurs, **Then** the archive is written to `/custom/path/archive.jsonl` instead of the default location.

2. **Given** `RAG_ARCHIVE_PATH` is not set, **When** an interaction occurs, **Then** the archive is written to the default location `./data/rag_archive.jsonl`.

3. **Given** `RAG_ARCHIVE_PATH` points to a non-existent directory, **When** an interaction occurs, **Then** the system creates the necessary parent directories before writing.

---

### User Story 3 - Reliable Archive Writes Under Load (Priority: P3)

As a power user running multiple concurrent searches, I want archive writes to be atomic and reliable so that my archive file never becomes corrupted even under high concurrency.

**Why this priority**: Data integrity is essential for a knowledge base, but most users won't encounter concurrent write scenarios.

**Independent Test**: Can be tested by executing multiple rapid concurrent searches and verifying all entries are written correctly without corruption.

**Acceptance Scenarios**:

1. **Given** multiple searches complete within milliseconds of each other, **When** archive writes occur, **Then** all entries are complete valid JSON lines (no interleaving or truncation).

2. **Given** a file write fails (disk full, permissions), **When** the error occurs, **Then** the system logs the error to stderr and the primary search functionality continues unaffected.

---

### Edge Cases

- What happens when the archive file exceeds available disk space? → Write fails gracefully with logged error; primary functionality continues.
- What happens when the archive path is read-only? → Logged error on startup with clear message; archival disabled but server operational.
- How does the system handle malformed UTF-8 in user prompts or responses? → Content is sanitized/escaped to ensure valid JSON output.
- What happens during server restart mid-write? → POSIX appendFile semantics ensure partial lines don't occur; worst case is one lost entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST append a `RagDocument` JSON object for every user message to the archive file.
- **FR-002**: System MUST append a `RagDocument` JSON object for every assistant response to the archive file.
- **FR-003**: System MUST use JSONL format (one JSON object per line, newline-delimited).
- **FR-004**: System MUST create the archive directory and file if they do not exist.
- **FR-005**: System MUST use atomic append operations (POSIX `appendFile`) to prevent corruption.
- **FR-006**: System MUST populate `chat_id` with the full Perplexity URL returned by the search.
- **FR-007**: System MUST populate `timestamp` with ISO 8601 formatted date/time.
- **FR-008**: System MUST populate `role` as `"user"` or `"assistant"` appropriately.
- **FR-009**: System MUST include `metadata.source` as `"perplexity-mcp-zerver"` for all entries.
- **FR-010**: System MUST include `metadata.citations` array when citations are available in the response.
- **FR-011**: System MUST include `metadata.model` when model information is available.
- **FR-012**: System MUST include `metadata.research_mode` when research mode is specified.
- **FR-013**: System MUST read archive path from `RAG_ARCHIVE_PATH` environment variable when set.
- **FR-014**: System MUST default to `./data/rag_archive.jsonl` when `RAG_ARCHIVE_PATH` is not set.
- **FR-015**: System MUST log errors to stderr when archive writes fail without crashing.
- **FR-016**: System MUST NOT block or fail the primary search response if archival fails.
- **FR-017**: System MUST generate unique UUIDs for each `id` field in the archive entries.

### Key Entities

- **RagDocument**: The archival record representing a single message (user or assistant) in a Perplexity interaction.
  - `id` (string): Unique UUID for this message
  - `chat_id` (string): Full Perplexity URL identifying the conversation
  - `timestamp` (string): ISO 8601 datetime when the message was recorded
  - `role` ("user" | "assistant"): Who generated this message
  - `content` (string): Full text content of the message
  - `metadata` (object): Additional context including source, model, citations, research_mode

- **RagArchiver**: The module responsible for managing archive writes.
  - Responsible for directory creation, atomic file appends, and error handling

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful Perplexity interactions result in corresponding JSONL entries (2 entries per search: user + assistant).
- **SC-002**: Archive entries pass JSON schema validation for the `RagDocument` interface.
- **SC-003**: Archive file can be read line-by-line and parsed by standard JSON parsers without errors.
- **SC-004**: System startup time is not increased by more than 100ms due to archive initialization.
- **SC-005**: Archive write failures do not impact search response time or success rate.
- **SC-006**: Archive files produced are successfully ingestible by common RAG tools (LangChain JSONL loader, LlamaIndex JSONReader).
- **SC-007**: Concurrent search operations (10+ simultaneous) produce valid, non-corrupted archive entries.

## Assumptions

- The deployment environment supports POSIX file system semantics (Linux, macOS, WSL2).
- The archive file will be consumed by external RAG ingestion tools; the MCP server does not need to read back from it.
- File rotation and archive management (compaction, deletion of old entries) are handled externally by the user or a separate process.
- The existing `chatPerplexity.ts` tool handler has access to the Perplexity URL and can pass it to the archiver.
- Citations extraction from Perplexity responses is already implemented or can be added to the search engine module.

## Out of Scope

- Built-in file rotation or size limits (user manages archive growth externally)
- Archive querying or search functionality within the MCP server
- Vector embedding generation (downstream RAG tools handle this)
- Compression of archive files
- Archive backup or replication
- Web UI for browsing archive contents
