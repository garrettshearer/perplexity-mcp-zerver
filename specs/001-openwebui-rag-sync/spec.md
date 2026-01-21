# Feature Specification: OpenWebUI RAG Integration

**Feature Branch**: `001-openwebui-rag-sync`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "OpenWebUI RAG Integration - Create a sync utility to push rag_archive.jsonl records to OpenWebUI's Knowledge Base system for RAG-powered chat"

## User Scenarios & Testing *(mandatory)*

USE OpenWebUI JWT TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxZTdkZWIwLTk3ZGItNGQyMC1iNDEyLWVkODRmOGZkYjhkMiIsImV4cCI6MTc3MDUyOTYxNn0.nHbAk0PQnQBxzq9vSmySUWjeYLPoD2A0KSE5ZZ_0p1c

### User Story 1 - Manual Sync of RAG Archive (Priority: P1)

As a developer using Perplexity MCP Server, I want to manually sync my accumulated Perplexity interactions from `rag_archive.jsonl` to OpenWebUI's Knowledge Base so that I can query my past research using RAG-powered chat.

**Why this priority**: This is the core functionality - without manual sync, no other features work. This enables the fundamental value proposition of making Perplexity interactions searchable via OpenWebUI.

**Independent Test**: Can be fully tested by running `pnpm sync:openwebui` with valid credentials and verifying the archive appears in OpenWebUI's Knowledge Base list.

**Acceptance Scenarios**:

1. **Given** a valid `rag_archive.jsonl` file with 10+ entries and valid OpenWebUI credentials, **When** I run `pnpm sync:openwebui`, **Then** the archive is uploaded to OpenWebUI and a knowledge base named "Perplexity RAG Archive" is created or updated
2. **Given** valid OpenWebUI credentials but no `rag_archive.jsonl` file exists, **When** I run `pnpm sync:openwebui`, **Then** I receive a clear error message indicating the archive file is missing
3. **Given** invalid OpenWebUI credentials (wrong API key), **When** I run `pnpm sync:openwebui`, **Then** I receive a clear authentication error message with guidance to check API key settings

---

### User Story 2 - Configuration via Environment Variables (Priority: P1)

As a developer, I want to configure the OpenWebUI connection using environment variables so that I can easily switch between different OpenWebUI instances without modifying code.

**Why this priority**: Configuration is essential for the sync to work in any environment. Without proper config, users cannot connect to their OpenWebUI instance.

**Independent Test**: Can be tested by setting environment variables and verifying the sync tool reads them correctly (even without performing actual sync).

**Acceptance Scenarios**:

1. **Given** `OPENWEBUI_URL` is set to `http://localhost:8090`, **When** I run the sync, **Then** the tool connects to that URL
2. **Given** `OPENWEBUI_URL` is not set, **When** I run the sync, **Then** the tool defaults to `http://localhost:8090`
3. **Given** `OPENWEBUI_API_KEY` is not set, **When** I run the sync, **Then** the tool fails with a clear error message explaining how to obtain and set the API key
4. **Given** `OPENWEBUI_KB_NAME` is set to "My Custom KB", **When** I run the sync, **Then** the knowledge base is created/updated with that name
5. **Given** `OPENWEBUI_KB_NAME` is not set, **When** I run the sync, **Then** the knowledge base is named "Perplexity RAG Archive"

---

### User Story 3 - Idempotent Sync with Status Feedback (Priority: P2)

As a developer, I want the sync to be idempotent and provide status feedback so that I can run it multiple times safely and understand what happened.

**Why this priority**: Idempotency prevents duplicate uploads and wasted resources. Status feedback helps users understand sync progress and troubleshoot issues.

**Independent Test**: Can be tested by running sync twice in succession and verifying no duplicate files are created in OpenWebUI.

**Acceptance Scenarios**:

1. **Given** I have already synced `rag_archive.jsonl` once, **When** I run sync again without changes to the archive, **Then** the tool detects no changes needed and reports "Already up to date"
2. **Given** a sync is in progress, **When** the file is being processed by OpenWebUI, **Then** I see progress updates indicating processing status
3. **Given** a sync completes successfully, **When** the process finishes, **Then** I see a summary showing: files uploaded, knowledge base name, and total records synced

---

### User Story 4 - Error Recovery and Retry (Priority: P3)

As a developer, I want the sync to handle transient errors gracefully so that network hiccups don't cause complete sync failures.

**Why this priority**: Network reliability varies. Graceful error handling improves user experience but is not essential for MVP functionality.

**Independent Test**: Can be tested by simulating network failures (e.g., temporarily stopping OpenWebUI) and verifying retry behavior.

**Acceptance Scenarios**:

1. **Given** a network timeout occurs during file upload, **When** the error is detected, **Then** the tool retries up to 3 times with exponential backoff
2. **Given** OpenWebUI returns a 5xx server error, **When** the error is detected, **Then** the tool retries up to 3 times before failing with a clear message
3. **Given** all retry attempts fail, **When** the sync gives up, **Then** the tool exits with a non-zero status code and logs the final error

---

### Edge Cases

- What happens when the `rag_archive.jsonl` file is empty (0 records)? → Tool should report "No records to sync" and exit successfully
- What happens when the file contains malformed JSON lines? → Tool should skip invalid lines, log warnings, and continue with valid records
- What happens when OpenWebUI file processing takes longer than 5 minutes? → Tool should timeout and report the processing status
- What happens when the knowledge base with the specified name already exists? → Tool should reuse the existing knowledge base
- What happens when the JSONL file is very large (>100MB)? → Tool should handle large files without memory issues (streaming approach)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read Perplexity interactions from `data/rag_archive.jsonl`
- **FR-002**: System MUST authenticate with OpenWebUI using the configured API key
- **FR-003**: System MUST create a knowledge base in OpenWebUI if one doesn't exist with the configured name
- **FR-004**: System MUST upload the JSONL archive file to OpenWebUI's file storage
- **FR-005**: System MUST wait for OpenWebUI to finish processing the uploaded file before completing
- **FR-006**: System MUST associate the uploaded file with the knowledge base
- **FR-007**: System MUST provide a CLI command (`pnpm sync:openwebui`) to trigger sync manually
- **FR-008**: System MUST read configuration from environment variables (`OPENWEBUI_URL`, `OPENWEBUI_API_KEY`, `OPENWEBUI_KB_NAME`)
- **FR-009**: System MUST provide clear error messages when configuration is missing or invalid
- **FR-010**: System MUST support retry logic for transient network failures (3 retries with exponential backoff)
- **FR-011**: System MUST exit with non-zero status code on failure
- **FR-012**: System MUST log progress and status updates to stderr during sync
- **FR-013**: System MUST detect when archive is unchanged and skip unnecessary uploads

### Key Entities *(include if feature involves data)*

- **RAG Archive Entry**: A single interaction record from Perplexity containing query, response, citations, and metadata (stored as JSON line in `rag_archive.jsonl`)
- **Knowledge Base**: An OpenWebUI container for organizing related knowledge files, identified by name and ID
- **Uploaded File**: A file stored in OpenWebUI's file system, associated with processing status and can be linked to knowledge bases

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can sync their RAG archive to OpenWebUI in under 30 seconds for files up to 10MB
- **SC-002**: Sync command provides clear feedback within 2 seconds of starting (connection status, authentication result)
- **SC-003**: 95% of sync attempts with valid credentials complete successfully on first try
- **SC-004**: Users can query their synced Perplexity interactions via OpenWebUI chat within 1 minute of sync completion
- **SC-005**: Error messages provide actionable guidance that allows users to resolve issues without consulting external documentation

## Assumptions

- OpenWebUI is running and accessible at the configured URL
- USE OpenWebUI JWT TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIxZTdkZWIwLTk3ZGItNGQyMC1iNDEyLWVkODRmOGZkYjhkMiIsImV4cCI6MTc3MDUyOTYxNn0.nHbAk0PQnQBxzq9vSmySUWjeYLPoD2A0KSE5ZZ_0p1c
- The user has obtained a valid API key from OpenWebUI (Profile > Settings > API Key)
- The `rag_archive.jsonl` file follows the existing format used by perplexity-mcp-zerver
- OpenWebUI supports JSONL file format for knowledge base ingestion
- Network connectivity to OpenWebUI is generally stable (transient failures are rare)

## Out of Scope

- Scheduled/automatic sync (manual trigger only in MVP)
- Bi-directional sync (only push to OpenWebUI, not pull)
- Selective sync of specific date ranges or queries
- Integration with other knowledge base systems
- Deletion or cleanup of old knowledge in OpenWebUI
