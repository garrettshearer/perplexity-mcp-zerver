# Feature Specification: Model Switching

**Feature Branch**: `001-model-switching`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Model Switching - Add ability to switch between AI models (Claude 3.5 Sonnet, GPT-4o, Sonar, etc.) via selector dropdown in Perplexity UI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch to a Specific AI Model (Priority: P1)

As an MCP client user, I want to specify which AI model to use for my query so that I can leverage different model capabilities (e.g., Claude for reasoning, GPT-4o for general tasks, Sonar for search-focused queries).

**Why this priority**: This is the core feature - without the ability to switch models, the entire feature has no value. Users need model flexibility to match their specific use cases.

**Independent Test**: Can be fully tested by calling any search or chat tool with a `model` parameter and verifying the Perplexity UI shows the selected model is active before the query executes.

**Acceptance Scenarios**:

1. **Given** a user is connected to the MCP server and Perplexity is open in the browser, **When** the user calls `search` with `model: "Claude 3.5 Sonnet"`, **Then** the system selects Claude 3.5 Sonnet from the dropdown before executing the search.
2. **Given** the model selector dropdown is visible, **When** the system attempts to switch to "GPT-4o", **Then** the dropdown opens, the GPT-4o option is found and clicked, and the dropdown closes with GPT-4o as the active model.
3. **Given** the user specifies a model name with different casing (e.g., "claude 3.5 sonnet"), **When** the system searches for the model, **Then** the matching is case-insensitive and finds "Claude 3.5 Sonnet".

---

### User Story 2 - Graceful Handling When Model Not Found (Priority: P2)

As an MCP client user, I want clear feedback when I request a model that doesn't exist in the dropdown so that I know what models are available and can correct my request.

**Why this priority**: Error handling is essential for a good user experience, but the core switching must work first.

**Independent Test**: Can be tested by calling a tool with an invalid model name and verifying a descriptive error is returned.

**Acceptance Scenarios**:

1. **Given** the user specifies a model that doesn't exist (e.g., "NonExistent-Model"), **When** the system searches the dropdown options, **Then** the system throws a clear error: `Model "NonExistent-Model" not found in dropdown options`.
2. **Given** the dropdown fails to open within the timeout period, **When** the system attempts to switch models, **Then** a timeout error is returned indicating the dropdown could not be accessed.

---

### User Story 3 - Default Model Behavior (Priority: P3)

As an MCP client user, I want tools to work without specifying a model so that I can use the currently-selected model in Perplexity without extra configuration.

**Why this priority**: This maintains backward compatibility and simplifies usage for users who don't need model switching.

**Independent Test**: Can be tested by calling tools without a `model` parameter and verifying they execute with whatever model is currently selected in Perplexity.

**Acceptance Scenarios**:

1. **Given** a user calls the `search` tool without a `model` parameter, **When** the tool executes, **Then** it uses the currently-selected model in Perplexity (no model switching occurs).
2. **Given** the user previously switched to GPT-4o and then calls search without a model parameter, **When** the search executes, **Then** GPT-4o remains selected and is used for the query.

---

### Edge Cases

- **Dropdown not visible**: What happens when the model selector dropdown is not present on the page (e.g., Perplexity UI changed, user not logged in, or on a page without model selection)?
- **Multiple matching models**: What happens if the user specifies a partial model name (e.g., "Claude") that matches multiple options (Claude 3.5 Sonnet, Claude 3 Opus)?
- **Network delay**: What happens if clicking the dropdown triggers a network request that delays the options appearing?
- **Already selected**: What happens if the user requests a model that's already the active selection?
- **Dropdown closes unexpectedly**: What happens if the dropdown closes before an option can be clicked (e.g., focus loss)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a function to switch AI models by interacting with the Perplexity model selector dropdown.
- **FR-002**: System MUST use multiple selector patterns (data-testid, aria-label, CSS classes) to locate the model dropdown for resilience against UI changes.
- **FR-003**: System MUST match model names case-insensitively using partial text matching.
- **FR-004**: System MUST wait up to 5 seconds for dropdown options to appear after opening the dropdown.
- **FR-005**: System MUST throw a descriptive error if the requested model is not found in the dropdown options.
- **FR-006**: System MUST throw a descriptive error if the dropdown cannot be opened or options cannot be loaded.
- **FR-007**: Tools (search, chat_perplexity, etc.) MUST accept an optional `model` parameter.
- **FR-008**: When `model` parameter is not provided, tools MUST use the currently-selected model without switching.
- **FR-009**: When `model` parameter is provided, tools MUST switch to the specified model before executing the query.

### Key Entities

- **Model Selector Dropdown**: The UI element in Perplexity that allows users to choose which AI model to use. Contains a trigger button and a list of model options.
- **Model Option**: An individual selectable item in the dropdown representing an AI model (e.g., Claude 3.5 Sonnet, GPT-4o, Sonar).
- **Available Models**: The set of AI models offered by Perplexity, which may change over time. Currently includes: Claude 3.5 Sonnet, GPT-4o, Sonar, and others.

## Assumptions

- The Perplexity UI will continue to have a model selector dropdown accessible from the main query interface.
- Model names displayed in the UI are human-readable (e.g., "Claude 3.5 Sonnet") rather than internal identifiers.
- The dropdown behavior follows standard patterns (click to open, click option to select, dropdown closes after selection).
- Users are logged into Perplexity and have access to model selection (Pro feature may be required).
- If multiple models partially match the user's input, the first match found is selected (deterministic behavior based on DOM order).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully switch between any available model in under 3 seconds.
- **SC-002**: Model switching succeeds on 95% of attempts when the requested model exists in the dropdown.
- **SC-003**: Users receive a clear, actionable error message within 6 seconds when requesting a non-existent model.
- **SC-004**: Tools continue to function normally when no model parameter is specified (100% backward compatibility).
- **SC-005**: Case-insensitive matching works for all model names regardless of user input casing.
