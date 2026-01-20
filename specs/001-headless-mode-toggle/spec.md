# Feature Specification: Toggle Headless Mode for Browser Visibility

**Feature Branch**: `001-headless-mode-toggle`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: User description: "Toggle Headless Mode for Browser Visibility - enables toggling between headless and visible browser modes for debugging/demos, uses puppeteer-extra with stealth plugin to reduce Cloudflare blocks, and implements a promise-based lock to prevent race conditions during browser initialization"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Debug Browser Automation Issues (Priority: P1)

As a developer debugging Perplexity MCP server issues, I want to see the browser window during operation so I can visually observe what's happening and identify problems with page navigation, element selection, or Cloudflare challenges.

**Why this priority**: Debugging is the primary use case for visible browser mode. Without visual feedback, developers cannot diagnose why searches fail, why elements aren't found, or how Cloudflare challenges manifest.

**Independent Test**: Can be fully tested by setting `PERPLEXITY_HEADLESS=false`, starting the server, and verifying the browser window appears when any search tool is invoked.

**Acceptance Scenarios**:

1. **Given** the environment variable `PERPLEXITY_HEADLESS` is set to `false`, **When** the server starts and a search tool is invoked, **Then** a visible browser window appears on screen
2. **Given** the environment variable `PERPLEXITY_HEADLESS` is not set, **When** the server starts and a search tool is invoked, **Then** the browser runs in headless mode (invisible)
3. **Given** the browser is running in visible mode, **When** observing the browser during a search, **Then** the developer can see all page interactions (navigation, typing, waiting)

---

### User Story 2 - Demonstrate MCP Server Capabilities (Priority: P2)

As a developer or product owner, I want to demonstrate the MCP server's browser automation to stakeholders by showing the visible browser performing searches and extracting content.

**Why this priority**: Demonstrations are valuable for stakeholder buy-in and training but are secondary to the core debugging functionality.

**Independent Test**: Can be fully tested by setting visible mode, invoking search tools, and observing smooth browser interactions suitable for presentation.

**Acceptance Scenarios**:

1. **Given** visible browser mode is enabled, **When** performing a search for demonstration, **Then** the browser window shows clear, observable interactions
2. **Given** the browser is in visible mode, **When** multiple sequential operations are performed, **Then** each operation is visually distinguishable

---

### User Story 3 - Reduce Cloudflare Detection Blocks (Priority: P1)

As a system operator, I want the browser to evade Cloudflare bot detection more effectively so that searches complete successfully without manual intervention.

**Why this priority**: Cloudflare blocks directly impact the server's core functionality. Improving evasion ensures reliable operation for all users.

**Independent Test**: Can be tested by running multiple searches and measuring the success rate compared to the baseline without stealth plugin.

**Acceptance Scenarios**:

1. **Given** the server uses puppeteer-extra with stealth plugin, **When** navigating to Perplexity.ai, **Then** the browser fingerprint is less detectable as automation
2. **Given** stealth plugin is active, **When** Cloudflare challenges are encountered, **Then** the success rate of passing challenges improves compared to vanilla puppeteer

---

### User Story 4 - Prevent Race Conditions During Initialization (Priority: P1)

As a developer using the MCP server, I want browser initialization to handle concurrent requests safely so that multiple simultaneous tool invocations don't corrupt browser state or cause crashes.

**Why this priority**: Race conditions cause intermittent failures that are difficult to diagnose and undermine server reliability. This is a correctness issue.

**Independent Test**: Can be tested by invoking multiple tools simultaneously and verifying only one browser instance is created.

**Acceptance Scenarios**:

1. **Given** the browser is not yet initialized, **When** two tools are invoked simultaneously, **Then** only one browser instance is created
2. **Given** browser initialization is in progress, **When** another request arrives, **Then** the second request waits for the first initialization to complete
3. **Given** initialization fails, **When** a subsequent request arrives, **Then** initialization is reattempted (the lock is released on failure)

---

### Edge Cases

- What happens when switching from headless to visible mode while the server is running? (Requires server restart)
- How does the system handle invalid values for `PERPLEXITY_HEADLESS` (e.g., "yes", "1", "TRUE")? (Only "false" disables headless; any other value defaults to headless mode)
- What happens if puppeteer-extra or stealth plugin fails to load? (Should fall back gracefully or fail with clear error message)
- How does visible mode behave on headless servers (e.g., CI/CD)? (Will fail to launch; should be documented)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support a `PERPLEXITY_HEADLESS` environment variable to control browser visibility
- **FR-002**: System MUST default to headless mode (invisible browser) when `PERPLEXITY_HEADLESS` is not set or has any value other than `"false"`
- **FR-003**: System MUST launch a visible browser window when `PERPLEXITY_HEADLESS` is set to `"false"`
- **FR-004**: System MUST use puppeteer-extra with the stealth plugin to reduce automation detection fingerprints
- **FR-005**: System MUST implement a promise-based lock for browser initialization to prevent race conditions
- **FR-006**: System MUST remove GPU-disabling browser arguments when running in visible mode (for proper rendering)
- **FR-007**: System MUST use modern headless mode (`'new'`) when running in headless mode for better compatibility
- **FR-008**: System MUST release the initialization lock if browser launch fails, allowing retry attempts
- **FR-009**: System MUST close any existing browser instance before creating a new one during initialization

### Key Entities

- **Configuration (CONFIG)**: Central configuration object containing browser settings including the new `HEADLESS` flag
- **PuppeteerContext**: Shared context object holding browser state, including the new `initPromise` for initialization locking
- **Browser**: Puppeteer browser instance that can operate in headless or visible mode
- **Stealth Plugin**: Puppeteer-extra plugin that modifies browser fingerprint to evade bot detection

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can toggle browser visibility with a single environment variable change and server restart
- **SC-002**: Browser initialization handles 10 concurrent tool invocations without creating duplicate browser instances
- **SC-003**: Visible mode displays a functional browser window within 5 seconds of first tool invocation
- **SC-004**: Stealth plugin integration does not increase browser startup time by more than 2 seconds
- **SC-005**: No regressions in existing functionality—all current tests continue to pass
- **SC-006**: Documentation clearly explains the `PERPLEXITY_HEADLESS` environment variable and its valid values

## Assumptions

- Users have a display server available when using visible mode (not running on headless CI servers)
- The puppeteer-extra and puppeteer-extra-plugin-stealth packages are compatible with the project's Node.js and puppeteer versions
- Stealth plugin's fingerprint modifications do not conflict with other browser evasion logic already in the codebase
- Environment variable configuration is the appropriate mechanism (vs. runtime API or config file) for this setting

## Out of Scope

- Runtime switching between headless and visible modes (requires restart)
- GUI configuration interface for browser settings
- Metrics or telemetry for Cloudflare block rates
- Automatic fallback to headless mode if visible mode fails on headless servers
