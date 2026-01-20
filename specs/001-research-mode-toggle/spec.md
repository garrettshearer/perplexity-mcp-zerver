# Feature Specification: Research Mode Toggle

**Feature Branch**: `001-research-mode-toggle`  
**Created**: January 20, 2026  
**Status**: Draft  
**Input**: User description: "Toggle between Search and Deep Research mode - Two modes: search (fast answers) and deep-research (comprehensive analysis). Check aria-selected to avoid redundant clicks. Use selector patterns with fallbacks. Default to search mode if not specified."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Search Query (Priority: P1)

As a user performing a simple lookup, I want my queries to be processed quickly in Search mode so I get fast, concise answers without waiting for comprehensive analysis.

**Why this priority**: Search mode is the default behavior and the most common use case. Users expect quick responses for straightforward questions.

**Independent Test**: Can be fully tested by sending a query without specifying research mode and verifying the system uses Search mode, returning results within the expected quick response time.

**Acceptance Scenarios**:

1. **Given** a user sends a query without specifying a research mode, **When** the query is processed, **Then** the system uses "search" mode by default and returns a fast, concise answer
2. **Given** a user explicitly sets `research_mode: 'search'`, **When** the query is processed, **Then** the system uses Search mode and returns results quickly
3. **Given** the system is already in Search mode, **When** a user sends another Search mode query, **Then** no mode toggle click occurs (efficiency optimization)

---

### User Story 2 - Deep Research Analysis (Priority: P1)

As a user conducting thorough research, I want to enable Deep Research mode so I receive comprehensive, detailed analysis with multiple sources and deeper investigation.

**Why this priority**: Deep Research mode is a core differentiating feature that provides significant value for complex queries requiring comprehensive answers.

**Independent Test**: Can be fully tested by sending a query with `research_mode: 'deep-research'` and verifying the system toggles to Deep Research mode and returns comprehensive results.

**Acceptance Scenarios**:

1. **Given** a user sets `research_mode: 'deep-research'`, **When** the query is processed, **Then** the system toggles to Deep Research mode before executing the query
2. **Given** the system is in Search mode, **When** a Deep Research query is requested, **Then** the mode toggle is clicked and the UI updates before proceeding
3. **Given** the system is already in Deep Research mode, **When** another Deep Research query is sent, **Then** no mode toggle click occurs (no redundant interaction)

---

### User Story 3 - Mode Switching Between Queries (Priority: P2)

As a user with varied query needs, I want to switch between Search and Deep Research modes across different queries so I can optimize response time versus depth as needed.

**Why this priority**: Mode switching between queries is important but secondary to the core functionality of each mode working correctly.

**Independent Test**: Can be fully tested by sending alternating queries with different mode settings and verifying each query uses the correct mode.

**Acceptance Scenarios**:

1. **Given** the system is in Deep Research mode, **When** a user sends a query with `research_mode: 'search'`, **Then** the system switches to Search mode before processing
2. **Given** a sequence of queries with alternating modes, **When** each query is processed, **Then** the correct mode is active for each query
3. **Given** the mode toggle element is not immediately visible, **When** a mode switch is needed, **Then** the system uses fallback selectors to locate and activate the toggle

---

### Edge Cases

- What happens when the mode toggle UI element is not found using any selector pattern? → System should log a warning and proceed with the current mode (graceful degradation)
- What happens when the `aria-selected` attribute check fails or returns unexpected values? → System should attempt the toggle action anyway rather than assuming current state
- How does the system handle slow UI transitions after mode toggle? → System waits for UI state to stabilize (500ms delay) before proceeding with the query
- What happens if the mode parameter contains an invalid value? → System should default to 'search' mode and log a warning

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support two research modes: 'search' (fast answers) and 'deep-research' (comprehensive analysis)
- **FR-002**: System MUST default to 'search' mode when no research_mode parameter is specified
- **FR-003**: System MUST check the current mode state (via `aria-selected` attribute) before attempting to toggle, to avoid redundant UI interactions
- **FR-004**: System MUST use multiple selector patterns with fallbacks to locate mode toggle elements (data-testid, aria-label, CSS class selectors)
- **FR-005**: System MUST wait for UI state to stabilize after mode toggle before proceeding with query execution
- **FR-006**: Tools that perform searches MUST accept an optional `research_mode` parameter with valid values 'search' or 'deep-research'
- **FR-007**: System MUST proceed gracefully if mode toggle element cannot be found, using the current mode rather than failing the request

### Key Entities

- **ResearchMode**: An enumeration with two values - 'search' (optimized for quick, concise responses) and 'deep-research' (optimized for comprehensive analysis)
- **ModeSelectors**: A configuration object containing selector patterns for locating mode toggle UI elements (toggle button, search mode button, deep research button)
- **ToolParameters**: Extended tool input schemas that include the optional `research_mode` parameter

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between Search and Deep Research modes within 1 second of mode toggle activation
- **SC-002**: System correctly identifies current mode state 95% of the time using aria-selected attribute check
- **SC-003**: Redundant mode toggle clicks are eliminated when consecutive queries use the same mode
- **SC-004**: All search-related tools accept and honor the optional research_mode parameter
- **SC-005**: Mode toggle succeeds using fallback selectors when primary selector is unavailable

## Assumptions

- The Perplexity web interface provides distinct UI elements for Search and Deep Research modes that can be programmatically accessed
- The `aria-selected` attribute reliably indicates the currently active mode
- A 500ms delay after toggle action is sufficient for UI state to stabilize
- The selector patterns (data-testid, aria-label, CSS class) cover the current and reasonably foreseeable UI implementations
