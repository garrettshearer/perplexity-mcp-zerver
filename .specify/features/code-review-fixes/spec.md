# Feature Specification: Code Review Fixes

**Feature Branch**: `feature/perplexity-enhancements-2026`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Code Review Fixes - Address type safety, streaming implementation, chat identity, and version sync issues identified in code review"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Type-Safe Server Operations (Priority: P1)

As a developer working on the perplexity-mcp-zerver codebase, I need the TypeScript compiler to catch interface mismatches at compile time rather than failing silently at runtime, so I can trust that my code changes won't break unexpectedly.

**Why this priority**: Type safety is foundational - `as any` casts hide real bugs and create "compiles but breaks at runtime" scenarios that are costly to debug and erode trust in the codebase.

**Independent Test**: Can be fully tested by running `pnpm build` with strict TypeScript settings and verifying zero `as any` casts remain in the flagged files.

**Acceptance Scenarios**:

1. **Given** `src/server/PerplexityServer.ts` calls `browserManager.getPuppeteerContext()`, **When** I compile the project, **Then** TypeScript validates the call without requiring `as any` cast
2. **Given** `src/login.ts` accesses Chrome extension APIs, **When** I compile the project, **Then** TypeScript recognizes the `chrome` global through proper type declarations without `(window as any).chrome`
3. **Given** the `IBrowserManager` interface, **When** I inspect its definition, **Then** it includes the `getPuppeteerContext()` method signature

---

### User Story 2 - MCP-Compatible Streaming Results (Priority: P1)

As an MCP client consuming perplexity search results, I need streaming responses to be properly accumulated and returned as complete text results, so I can receive progressive updates without breaking the MCP protocol contract.

**Why this priority**: The current streaming implementation is non-functional - `AsyncGenerator` results are returned directly instead of being iterated, causing broken responses for streaming requests.

**Independent Test**: Can be fully tested by calling the search tool with `stream: true` and verifying a complete accumulated text response is returned.

**Acceptance Scenarios**:

1. **Given** a search request with `stream: true`, **When** the search engine returns an `AsyncGenerator`, **Then** `toolHandlerSetup.ts` detects and iterates the generator
2. **Given** the tool handler is iterating a streaming result, **When** chunks arrive, **Then** they are accumulated into a single complete string
3. **Given** streaming is in progress, **When** the generator completes, **Then** the accumulated result is returned as standard MCP tool output
4. **Given** a non-streaming search request, **When** the search completes, **Then** the result is returned directly without generator detection logic

---

### User Story 3 - URL-Based Chat Identity (Priority: P2)

As a user resuming a chat conversation, I need the chat_id to be the actual Perplexity URL rather than a generated UUID, so I can reliably continue conversations and share chat links.

**Why this priority**: Current UUID-based chat IDs are arbitrary and don't correspond to actual Perplexity conversations, making chat resumption unreliable and links non-shareable.

**Independent Test**: Can be fully tested by initiating a new chat, capturing the returned chat_id, verifying it's a valid Perplexity URL, and using it to successfully resume the conversation.

**Acceptance Scenarios**:

1. **Given** a new chat request without an existing chat_id, **When** the search completes, **Then** the response includes the actual Perplexity chat URL as the chat_id
2. **Given** `SearchEngine.performSearch()` completes, **When** it returns results, **Then** the return object includes `{ answer: string, url: string, citations: string[] }`
3. **Given** a chat_id is returned to the client, **When** stored in SQLite, **Then** it's stored as a TEXT column containing the URL
4. **Given** I receive a chat_id URL, **When** I open it in a browser, **Then** it navigates to the actual Perplexity conversation

---

### User Story 4 - Consistent Version Reporting (Priority: P3)

As an operator debugging an issue with the MCP server, I need the server's reported version to match the package.json version, so I can accurately identify which version is deployed and reference the correct documentation.

**Why this priority**: Version mismatch between package.json (0.3.1) and internal server version (0.2.0) causes confusion during debugging and client compatibility checks.

**Independent Test**: Can be fully tested by checking `package.json` version and the MCP server's initialization response - they must match.

**Acceptance Scenarios**:

1. **Given** `package.json` contains version "X.Y.Z", **When** the MCP server initializes, **Then** it reports the same version "X.Y.Z"
2. **Given** the version is updated in `package.json`, **When** the server is rebuilt, **Then** the internal version automatically reflects the change

---

### Edge Cases

- What happens when `browserManager.getPuppeteerContext()` is called before the browser is initialized?
- How does the system handle streaming when the generator throws an error mid-iteration?
- What happens if Perplexity changes their URL structure for chat pages?
- How does the system handle a chat_id URL that is no longer valid (404)?
- What happens when version sync mechanism encounters a malformed package.json?

## Requirements *(mandatory)*

### Functional Requirements

#### Type Safety

- **FR-001**: System MUST NOT use `as any` casts in `src/server/PerplexityServer.ts`
- **FR-002**: `IBrowserManager` interface MUST declare the `getPuppeteerContext()` method with proper return type
- **FR-003**: System MUST provide TypeScript type declarations for Chrome extension APIs used in `login.ts`
- **FR-004**: All interface implementations MUST satisfy their contracts without type assertions

#### Streaming Implementation

- **FR-005**: `toolHandlerSetup.ts` MUST detect `AsyncGenerator` results using `Symbol.asyncIterator` check
- **FR-006**: System MUST iterate async generators to completion before returning results
- **FR-007**: System MUST accumulate all streamed chunks into a single string response
- **FR-008**: System MAY emit progress notifications via stderr during streaming iteration
- **FR-009**: System MUST return accumulated results as standard MCP tool output text

#### Chat Identity

- **FR-010**: `SearchEngine.performSearch()` MUST return an object containing `{ answer: string, url: string, citations: string[] }`
- **FR-011**: System MUST NOT generate client-side UUIDs for chat_id in `chatPerplexity.ts`
- **FR-012**: System MUST use the returned Perplexity URL as the canonical `chat_id`
- **FR-013**: Database MUST store `chat_id` as TEXT column containing the URL
- **FR-014**: Chat tool responses MUST include the URL-based chat_id for client resumption

#### Version Sync

- **FR-015**: `PerplexityServer` internal version MUST match `package.json` version
- **FR-016**: Version synchronization SHOULD be automatic (derived at build time or import)

### Key Entities

- **IBrowserManager Interface**: Browser automation abstraction that MUST include `getPuppeteerContext()` method
- **SearchResult**: Return type from `performSearch()` containing answer text, page URL, and citations array
- **Chat Message**: Database entity with `chat_id` stored as URL text, not UUID

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero `as any` casts remain in the flagged files (`PerplexityServer.ts`, `login.ts`)
- **SC-002**: TypeScript compilation succeeds with strict mode enabled and no type errors
- **SC-003**: 100% of streaming search requests return complete accumulated text (not generator objects)
- **SC-004**: 100% of new chat sessions return a valid Perplexity URL as chat_id
- **SC-005**: Server version in MCP initialization response matches package.json version exactly
- **SC-006**: All existing tests continue to pass after refactoring
- **SC-007**: Chat resumption works reliably using URL-based chat_ids

## Assumptions

- The Perplexity website will continue to provide stable, reusable chat URLs
- The `better-sqlite3` or current SQLite implementation supports TEXT columns without length limits
- MCP clients can handle URL strings as chat_id values (no UUID format validation)
- Progress notifications via stderr are optional and won't break standard MCP clients
- The Chrome extension API types can be obtained via `@types/chrome` or custom declarations
