# Feature Specification: Redirect to Existing Chat by URL

**Feature Branch**: `001-chat-redirect`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Redirect to Existing Chat by URL - Navigate directly to existing Perplexity chat sessions using URL, with chat history pre-loaded from URL rather than re-typing messages"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continue Existing Chat Session (Priority: P1)

As a user of the Perplexity MCP tool, I want to continue an existing chat conversation by providing its URL, so that I can ask follow-up questions without starting over.

**Why this priority**: This is the core functionality - users need to resume conversations they've already started. Without this, users would have to re-type their entire conversation history, which defeats the purpose of chat continuity.

**Independent Test**: Can be fully tested by providing a valid Perplexity chat URL and verifying the chat opens with history pre-loaded and the input textarea is ready for new messages.

**Acceptance Scenarios**:

1. **Given** a valid Perplexity chat URL (e.g., `perplexity.ai/search/abc123`), **When** I invoke the chat tool with this URL, **Then** the browser navigates directly to that chat session with existing history visible.

2. **Given** the chat has been navigated to successfully, **When** the page finishes loading, **Then** the textarea input is available and interactive (ready for new messages).

3. **Given** a chat session has been opened via URL, **When** I send a follow-up message, **Then** the message appears as a continuation of the existing conversation (not a new chat).

---

### User Story 2 - Extract Chat ID from Various URL Formats (Priority: P1)

As a user, I want to provide chat URLs in different formats (search URL, chat URL, full URL, partial URL), so that the tool flexibly accepts however I've copied the link.

**Why this priority**: Users copy URLs from different contexts (browser address bar, share links, etc.) and the tool must handle all common formats to be usable.

**Independent Test**: Can be tested by passing various URL patterns and verifying the chat ID is correctly extracted.

**Acceptance Scenarios**:

1. **Given** a URL in format `https://www.perplexity.ai/search/abc123-def456`, **When** the chat ID is extracted, **Then** it returns `abc123-def456`.

2. **Given** a URL in format `https://perplexity.ai/chat/xyz789`, **When** the chat ID is extracted, **Then** it returns `xyz789`.

3. **Given** a URL in format `perplexity.ai/search/abc123` (no protocol), **When** the chat ID is extracted, **Then** it returns `abc123`.

4. **Given** an invalid URL or a URL without a chat ID, **When** the chat ID extraction is attempted, **Then** it returns null/empty and the tool provides a clear error message.

---

### User Story 3 - Use Chat ID Directly (Priority: P2)

As a power user, I want to provide just the chat ID (without the full URL), so that I can quickly resume a chat if I already know the ID.

**Why this priority**: Convenience feature for users who have chat IDs stored or who want a more concise invocation. The URL-based flow is the primary use case.

**Independent Test**: Can be tested by providing only a chat ID string and verifying the tool constructs the correct URL and navigates to the chat.

**Acceptance Scenarios**:

1. **Given** a standalone chat ID `abc123-def456`, **When** I invoke the chat tool with this ID, **Then** the tool constructs the full URL and navigates to that chat session.

2. **Given** an invalid chat ID format, **When** I invoke the chat tool, **Then** the tool provides a clear error message indicating the chat could not be found or the ID is malformed.

---

### Edge Cases

- What happens when the chat URL is valid but the chat no longer exists (deleted or expired)?
  - The tool should detect the error state and return a clear message rather than hanging.
  
- What happens when the user is not authenticated to Perplexity?
  - The tool should recognize the login redirect and prompt the user to authenticate first.
  
- What happens when the page takes longer than expected to load?
  - The tool should timeout gracefully after a reasonable period (30 seconds) with a clear error message.
  
- What happens when the textarea selector changes due to Perplexity UI updates?
  - The tool should fail with a clear error indicating the UI element was not found, making debugging easier.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract chat IDs from Perplexity URLs matching patterns `/search/{chatId}` and `/chat/{chatId}`.

- **FR-002**: System MUST navigate directly to the chat URL without replaying or re-typing previous messages (chat history is pre-loaded by the URL).

- **FR-003**: System MUST wait for the page DOM to fully load before considering navigation complete.

- **FR-004**: System MUST verify the chat is interactive by confirming the message input textarea is present and ready.

- **FR-005**: The chat tool MUST accept an optional `chat_url` parameter for providing the full chat URL.

- **FR-006**: The chat tool MUST accept an optional `chat_id` parameter for providing just the chat identifier.

- **FR-007**: If both `chat_id` and `chat_url` are provided, `chat_url` takes precedence.

- **FR-008**: System MUST return a clear error message if the chat cannot be opened (invalid URL, chat not found, timeout).

- **FR-009**: System MUST timeout navigation after 30 seconds if the page fails to load.

- **FR-010**: System MUST timeout waiting for the textarea after 10 seconds if it doesn't appear.

### Key Entities

- **Chat ID**: A unique alphanumeric identifier (may include hyphens) that identifies a specific Perplexity conversation session. Extracted from URLs or provided directly by user.

- **Chat URL**: The full Perplexity URL pointing to a specific chat session. Contains the chat ID as a path segment.

- **Puppeteer Context**: The browser automation context that maintains the active page and browser instance for interacting with Perplexity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open an existing chat session within 5 seconds of providing a valid URL (excluding network latency).

- **SC-002**: Chat ID extraction correctly handles 100% of valid Perplexity URL formats (`/search/` and `/chat/` patterns).

- **SC-003**: The textarea availability check confirms the chat is ready for input within 10 seconds of page load.

- **SC-004**: Failed navigations (invalid URL, expired chat, timeout) return actionable error messages within the timeout period.

- **SC-005**: Zero messages are re-typed when opening an existing chat - the conversation history is entirely loaded from the URL.

## Assumptions

- Perplexity chat URLs follow consistent patterns (`/search/{id}` or `/chat/{id}`) and this format is stable.
- The textarea element for message input has a consistent selector pattern containing `Ask` in its placeholder.
- The existing Puppeteer browser initialization and page management functions are available and working.
- Authentication state is handled separately - this feature assumes the user is already logged into Perplexity or handles unauthenticated access gracefully.
