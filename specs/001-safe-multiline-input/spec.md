# Feature Specification: Safe Input for Multiline Prompts

**Feature Branch**: `001-safe-multiline-input`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Safe Input for Multiline Prompts - Implement safe input method that sets value directly on textarea to avoid keyboard issues with newlines and special characters"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Multiline Prompts (Priority: P1)

As a user sending prompts to Perplexity via the MCP server, I want my multiline prompts (containing newline characters) to be submitted correctly without corruption or character loss, so that my complex queries are understood exactly as I intended.

**Why this priority**: Multiline input is a critical core capability - prompts with code blocks, lists, or structured content are common use cases. Without this, users cannot reliably send complex queries.

**Independent Test**: Can be fully tested by sending a prompt containing newline characters and verifying the exact text appears in the Perplexity input field with line breaks preserved.

**Acceptance Scenarios**:

1. **Given** a prompt containing newline characters, **When** the prompt is submitted via the MCP server, **Then** the textarea receives the exact text with line breaks preserved
2. **Given** a prompt with multiple consecutive newlines, **When** the prompt is submitted, **Then** all newlines are preserved (not collapsed)
3. **Given** a prompt with code blocks (using triple backticks and newlines), **When** the prompt is submitted, **Then** the code formatting is preserved exactly

---

### User Story 2 - Handle Special Characters (Priority: P1)

As a user sending prompts containing special characters (quotes, brackets, Unicode, emojis), I want these characters to be transmitted without escaping issues or corruption, so that my queries appear exactly as intended.

**Why this priority**: Special characters are fundamental to technical queries (code snippets, mathematical notation, international text). This is essential for reliable operation.

**Independent Test**: Can be fully tested by sending prompts with various special characters and verifying they appear unchanged in the input field.

**Acceptance Scenarios**:

1. **Given** a prompt containing single quotes, double quotes, and backticks, **When** the prompt is submitted, **Then** all quote characters appear correctly
2. **Given** a prompt with brackets and special characters like braces, angle brackets, and symbols, **When** the prompt is submitted, **Then** all characters are preserved
3. **Given** a prompt with Unicode characters or emojis, **When** the prompt is submitted, **Then** all Unicode content displays correctly

---

### User Story 3 - Trigger React Change Detection (Priority: P1)

As a Perplexity user via the MCP server, I want the submit button to become enabled after text input, so that I can actually send my query after the text is populated.

**Why this priority**: React applications require proper event dispatch to update internal state. Without triggering change detection, the form may not recognize that input has occurred, preventing submission.

**Independent Test**: Can be fully tested by setting textarea value and verifying the submit button becomes clickable/enabled.

**Acceptance Scenarios**:

1. **Given** text is set directly on the textarea, **When** the appropriate input event is dispatched, **Then** the submit button becomes enabled
2. **Given** the textarea has focus state requirements, **When** text is input via direct value setting, **Then** focus state is handled appropriately for submission
3. **Given** React's synthetic event system, **When** the input event bubbles, **Then** React's internal state updates to reflect the new value

---

### User Story 4 - Robust Submit Button Detection (Priority: P2)

As a user of the MCP server, I want the submit process to work even if Perplexity's UI changes slightly, so that minor UI updates don't break my workflow.

**Why this priority**: UI selectors can change between Perplexity updates. Multiple fallback selectors increase resilience without requiring immediate code changes.

**Independent Test**: Can be tested by mocking different DOM structures and verifying the submit button is found via fallback selectors.

**Acceptance Scenarios**:

1. **Given** the submit button has aria-label containing "submit", **When** looking for the submit button, **Then** it is found and clicked
2. **Given** the submit button has aria-label containing "Send", **When** the primary selector fails, **Then** the fallback selector finds and clicks it
3. **Given** the submit button has a data-testid attribute, **When** other selectors fail, **Then** this fallback selector succeeds

---

### Edge Cases

- What happens when the textarea is not found within the timeout period? → Throw clear error with selector information
- How does system handle extremely long prompts (10,000+ characters)? → Set value directly in one operation, verify complete value is set
- What happens if the submit button is disabled or not found? → Retry with exponential backoff, then fail with descriptive error
- How does system handle prompts with only whitespace? → Pass through unchanged, let Perplexity handle validation
- What happens if React's change detection fails to trigger? → Try multiple event types (input, change, blur) as fallbacks

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST set textarea value directly using page.$eval() or equivalent DOM manipulation instead of keyboard.type()
- **FR-002**: System MUST preserve all newline characters in the input text
- **FR-003**: System MUST preserve all special characters without escaping or corruption
- **FR-004**: System MUST dispatch an input event with bubbles: true after setting the value to trigger React change detection
- **FR-005**: System MUST use multiple fallback selectors for the submit button in priority order
- **FR-006**: System MUST wait for the submit button to be visible and clickable before attempting to click
- **FR-007**: System MUST throw a descriptive error if the textarea is not found within the configured timeout
- **FR-008**: System MUST handle Unicode characters including emojis correctly (UTF-8 encoding preserved)
- **FR-009**: System MUST verify the value was successfully set before proceeding to submission
- **FR-010**: System MUST export the safe input function from src/utils/puppeteer.ts for use by all tools

### Key Entities

- **Textarea Element**: The Perplexity chat input field, identified by selectors like textarea with placeholder containing "Ask"
- **Submit Button**: The button that sends the message, identified via aria-labels or data-testids
- **Input Event**: DOM event that triggers React's synthetic event system to update component state

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of prompts containing newline characters are transmitted with line breaks preserved
- **SC-002**: 100% of prompts containing special characters are transmitted without corruption
- **SC-003**: Submit button is successfully clicked within 5 seconds of setting textarea value
- **SC-004**: Zero instances of keyboard.type() remain in message input code paths
- **SC-005**: Test suite includes at least 5 test cases covering multiline, special characters, Unicode, and edge cases
- **SC-006**: Feature works correctly across at least 3 different Perplexity UI selector variations (resilience)

## Assumptions

- Perplexity's web interface uses React and requires proper event dispatch for state updates
- The textarea element will be findable using attribute-based selectors (placeholder, data-testid)
- The submit button will have identifiable attributes (aria-label, data-testid, or similar)
- Standard DOM events (input, change) will trigger React's synthetic event handlers
- The existing selector constants in puppeteer-logic.ts can be extended for input-specific selectors
