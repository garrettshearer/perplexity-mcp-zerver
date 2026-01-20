/**
 * Pure business logic extracted from puppeteer utilities
 * These functions can be tested without mocking Puppeteer
 */

import type { ErrorAnalysis, RecoveryContext, ResearchMode } from "../types/index.js";

// ─── RESEARCH MODE SELECTORS ──────────────────────────────────────────
/**
 * Selectors for research mode toggle UI elements in priority order.
 * Multiple selectors provide resilience against UI changes (FR-004).
 */
export const RESEARCH_MODE_SELECTORS = {
  /** Mode toggle container */
  toggleContainer: [
    '[data-testid="research-mode-toggle"]',
    '[data-testid="mode-toggle"]',
    '[aria-label*="research mode" i]',
    '[aria-label*="mode toggle" i]',
    '[class*="ResearchModeToggle"]',
    '[class*="research-mode"]',
    '[class*="mode-toggle"]',
  ],
  /** Search mode button selectors */
  searchModeButton: [
    '[data-testid="search-mode"]',
    '[aria-label="Search" i]',
    '[aria-label*="search mode" i]',
    'button[class*="search-mode"]',
    '[class*="SearchMode"]',
  ],
  /** Deep Research mode button selectors */
  deepResearchButton: [
    '[data-testid="deep-research-mode"]',
    '[data-testid="research-mode"]',
    '[aria-label="Deep Research" i]',
    '[aria-label*="deep research" i]',
    '[aria-label*="comprehensive" i]',
    'button[class*="deep-research"]',
    'button[class*="research-mode"]',
    '[class*="DeepResearch"]',
  ],
  /** Active state indicator */
  activeIndicator: [
    '[aria-selected="true"]',
    '[data-selected="true"]',
    '[class*="selected"]',
    '[class*="active"]',
  ],
} as const;

/**
 * Check if the current research mode matches the requested mode.
 * Uses aria-selected attribute as primary indicator.
 *
 * @param ariaSelected - The aria-selected attribute value from the button
 * @param selectedClass - Whether the element has selected/active class
 * @returns True if the mode appears to be active
 */
export function isResearchModeActive(
  ariaSelected: string | null,
  selectedClass = false,
): boolean {
  // Primary check: aria-selected attribute (FR-003)
  if (ariaSelected === "true") {
    return true;
  }

  // Fallback: check for selected class
  if (selectedClass) {
    return true;
  }

  return false;
}

/**
 * Get the appropriate selectors array for the given research mode.
 *
 * @param mode - The research mode to get selectors for
 * @returns Array of CSS selectors for the mode button
 */
export function getResearchModeSelectors(mode: ResearchMode): readonly string[] {
  return mode === "search"
    ? RESEARCH_MODE_SELECTORS.searchModeButton
    : RESEARCH_MODE_SELECTORS.deepResearchButton;
}

// ─── MODEL SWITCHING SELECTORS ────────────────────────────────────────
/**
 * Selectors for model switching UI elements in priority order.
 * Multiple selectors provide resilience against UI changes (FR-002).
 */
export const MODEL_SELECTORS = {
  /** Dropdown trigger button selectors */
  dropdownTrigger: [
    '[data-testid="model-selector"]',
    '[aria-label*="model" i]',
    '[aria-label*="Model" i]',
    'button[class*="model"]',
    '[class*="ModelSelector"]',
    '[class*="model-selector"]',
    // Fallback: look for dropdown near the input area
    'button[aria-haspopup="listbox"]',
    'button[aria-haspopup="menu"]',
  ],
  /** Dropdown options container selectors */
  optionsContainer: [
    '[role="listbox"]',
    '[role="menu"]',
    '[data-testid="model-options"]',
    '[class*="dropdown-content"]',
    '[class*="ModelList"]',
    '[class*="model-list"]',
  ],
  /** Individual model option selectors */
  optionItem: [
    '[role="option"]',
    '[role="menuitem"]',
    '[data-testid="model-option"]',
    '[class*="model-item"]',
    '[class*="ModelItem"]',
  ],
  /** Current selection indicator */
  currentSelection: [
    '[aria-selected="true"]',
    '[data-selected="true"]',
    '[class*="selected"]',
    '[class*="active"]',
  ],
} as const;

/**
 * Normalize model name for comparison by:
 * - Converting to lowercase
 * - Removing extra whitespace
 * - Trimming leading/trailing whitespace
 *
 * @param modelName - The model name to normalize
 * @returns Normalized model name string
 */
export function normalizeModelName(modelName: string): string {
  return modelName.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Check if a model option matches the requested model name.
 * Supports:
 * - Exact match (case-insensitive)
 * - Partial match (e.g., "Claude" matches "Claude 3.5 Sonnet")
 *
 * @param optionText - The text content of the model option
 * @param requestedModel - The model name requested by the user
 * @returns True if the option matches the requested model
 */
export function matchesModelName(optionText: string, requestedModel: string): boolean {
  const normalizedOption = normalizeModelName(optionText);
  const normalizedRequest = normalizeModelName(requestedModel);

  // Exact match
  if (normalizedOption === normalizedRequest) {
    return true;
  }

  // Partial match: option contains the request (e.g., "claude 3.5 sonnet" contains "claude")
  if (normalizedOption.includes(normalizedRequest)) {
    return true;
  }

  // Partial match: request contains the option (less common but supported)
  if (normalizedRequest.includes(normalizedOption)) {
    return true;
  }

  return false;
}

/**
 * Determine recovery level based on error and context
 */
export function determineRecoveryLevel(error?: Error, context?: RecoveryContext): number {
  if (!error) return 1;

  const errorMsg = error.message.toLowerCase();

  // Critical errors require full restart
  if (
    errorMsg.includes("frame") ||
    errorMsg.includes("detached") ||
    errorMsg.includes("session closed") ||
    errorMsg.includes("target closed") ||
    errorMsg.includes("protocol error")
  ) {
    return 3; // Full restart
  }

  // Browser connectivity issues
  if (!context?.hasBrowser || !context?.isBrowserConnected) {
    return 3; // Full restart
  }

  // Page issues
  if (!context?.hasValidPage) {
    return 2; // New page
  }

  // Default to page refresh
  return 1;
}

/**
 * Analyze error characteristics
 */
export function analyzeError(error: Error | string): ErrorAnalysis {
  const errorMsg = typeof error === "string" ? error : error.message;
  const lowerMsg = errorMsg.toLowerCase();

  return {
    isTimeout: lowerMsg.includes("timeout") || lowerMsg.includes("timed out"),
    isNavigation: lowerMsg.includes("navigation") || lowerMsg.includes("Navigation"),
    isConnection:
      lowerMsg.includes("net::") || lowerMsg.includes("connection") || lowerMsg.includes("network"),
    isDetachedFrame:
      lowerMsg.includes("frame") ||
      lowerMsg.includes("detached") ||
      lowerMsg.includes("session closed"),
    isCaptcha: lowerMsg.includes("captcha") || lowerMsg.includes("challenge"),
    consecutiveTimeouts: 0, // This would be tracked externally
    consecutiveNavigationErrors: 0, // This would be tracked externally
  };
}

/**
 * Generate non-cryptographic jitter for retry delays
 * Note: Math.random() is safe here - only used for timing distribution, not security
 */
function generateRetryJitter(maxJitter: number): number {
  return Math.random() * maxJitter;
}

/**
 * Generate variable delay for connection errors to distribute load
 * Note: Math.random() is safe here - only used for timing distribution, not security
 */
function generateConnectionDelay(): number {
  return 15000 + Math.random() * 10000; // 15-25 seconds
}

/**
 * Generate variable delay for detached frame errors
 * Note: Math.random() is safe here - only used for timing distribution, not security
 */
function generateDetachedFrameDelay(): number {
  return 10000 + Math.random() * 5000; // 10-15 seconds
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attemptNumber: number,
  errorAnalysis: ErrorAnalysis,
  maxDelay = 30000,
): number {
  let baseDelay: number;

  if (errorAnalysis.isTimeout) {
    baseDelay = Math.min(5000 * (errorAnalysis.consecutiveTimeouts + 1), maxDelay);
  } else if (errorAnalysis.isNavigation) {
    baseDelay = Math.min(8000 * (errorAnalysis.consecutiveNavigationErrors + 1), 40000);
  } else if (errorAnalysis.isConnection) {
    baseDelay = generateConnectionDelay();
  } else if (errorAnalysis.isDetachedFrame) {
    baseDelay = generateDetachedFrameDelay();
  } else {
    // Standard exponential backoff
    baseDelay = Math.min(1000 * 2 ** attemptNumber, maxDelay);
  }

  // Add jitter to prevent thundering herd problems
  const maxJitter = Math.min(1000 * (attemptNumber + 1), 10000);
  const jitter = generateRetryJitter(maxJitter);

  return baseDelay + jitter;
}

/**
 * Generate comprehensive browser launch arguments optimized for Cloudflare bypass
 */
export function generateBrowserArgs(userAgent: string): string[] {
  return [
    // Essential security flags
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-web-security",

    // Enhanced anti-detection for Cloudflare
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-infobars",
    "--disable-notifications",
    "--disable-popup-blocking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-translate",
    "--disable-sync",
    "--disable-background-networking",
    "--disable-client-side-phishing-detection",
    "--disable-component-update",
    "--disable-hang-monitor",
    "--disable-prompt-on-repost",
    "--disable-domain-reliability",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-component-extensions-with-background-pages",
    "--disable-ipc-flooding-protection",
    "--disable-back-forward-cache",
    "--disable-partial-raster",
    "--disable-skia-runtime-opts",
    "--disable-smooth-scrolling",
    "--disable-features=site-per-process,TranslateUI,BlinkGenPropertyTrees",
    "--enable-features=NetworkService,NetworkServiceInProcess",

    // Performance and resource optimizations
    "--disable-accelerated-2d-canvas",
    "--disable-gpu",
    "--force-color-profile=srgb",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--use-mock-keychain",

    // Window and viewport settings - optimized for low-end systems while maintaining realistic behavior
    "--window-size=1280,720",

    // User agent
    `--user-agent=${userAgent}`,
  ];
}

/**
 * List of possible search input selectors in priority order
 */
export function getSearchInputSelectors(): string[] {
  return [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Search"]',
    "textarea.w-full",
    'textarea[rows="1"]',
    '[role="textbox"]',
    "textarea",
  ];
}

/**
 * Comprehensive CAPTCHA and Cloudflare challenge detection selectors
 */
export function getCaptchaSelectors(): string[] {
  return [
    // Generic CAPTCHA selectors
    '[class*="captcha"]',
    '[id*="captcha"]',
    'iframe[src*="captcha"]',
    'iframe[src*="recaptcha"]',

    // Cloudflare Turnstile specific
    'iframe[src*="turnstile"]',
    '[class*="turnstile"]',
    '[id*="turnstile"]',

    // Cloudflare challenge page selectors
    "#challenge-running",
    "#challenge-form",
    ".challenge-running",
    ".challenge-form",
    '[class*="challenge"]',
    '[id*="challenge"]',

    // Cloudflare specific elements
    ".cf-browser-verification",
    ".cf-checking-browser",
    ".cf-under-attack",
    "#cf-wrapper",
    ".cf-im-under-attack",

    // Additional Cloudflare patterns
    "[data-ray]", // Cloudflare Ray ID indicator
    ".ray-id",
    "#cf-error-details",
    ".cf-error-overview",

    // Bot detection indicators
    '[class*="bot-detection"]',
    '[class*="security-check"]',
    '[class*="verification"]',

    // Generic challenge indicators
    'body[class*="challenge"]',
    'html[class*="challenge"]',
  ];
}

/**
 * Validate URL for navigation
 */
export function validateNavigationUrl(url: string, expectedDomain?: string): boolean {
  try {
    const parsedUrl = new URL(url);

    if (expectedDomain && !parsedUrl.hostname.includes(expectedDomain)) {
      return false;
    }

    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Check if error indicates a page navigation failure
 */
export function isNavigationFailure(url: string, expectedUrl?: string): boolean {
  if (!url || url === "N/A") return true;

  if (expectedUrl) {
    try {
      const actual = new URL(url);
      const expected = new URL(expectedUrl);
      return actual.hostname !== expected.hostname;
    } catch {
      return true;
    }
  }

  return false;
}

// ─── SUBMIT BUTTON SELECTORS ──────────────────────────────────────────

/**
 * Submit button selectors in priority order.
 * Multiple selectors provide resilience against UI changes (FR-005).
 *
 * Priority reasoning:
 * 1. Accessibility attributes (aria-label) - most stable, required for a11y
 * 2. Test hooks (data-testid) - intentionally stable for testing
 * 3. Semantic HTML (type="submit") - standards-based
 * 4. Class-based - least stable, last resort
 */
export const SUBMIT_BUTTON_SELECTORS = [
  // Accessibility-first (most stable)
  '[aria-label*="submit" i]',
  '[aria-label*="send" i]',
  '[aria-label*="Submit"]',
  '[aria-label*="Send"]',

  // Test hooks (intentionally stable)
  '[data-testid*="submit"]',
  '[data-testid*="send"]',
  '[data-testid="submit-button"]',
  '[data-testid="send-button"]',

  // Semantic HTML (standards-based)
  'button[type="submit"]',
  'form button:last-of-type', // Common pattern: submit is last button in form

  // Class-based fallbacks (least stable)
  'button[class*="submit"]',
  'button[class*="send"]',
  'button[class*="Submit"]',
  'button[class*="Send"]',
  'button svg[class*="arrow"]', // SVG arrow icon fallback for Perplexity
] as const;

/**
 * Type for submit button selector tuple.
 */
export type SubmitButtonSelector = (typeof SUBMIT_BUTTON_SELECTORS)[number];

/**
 * Textarea selectors for chat input detection.
 * Multiple selectors provide resilience against UI changes.
 */
export const TEXTAREA_SELECTORS = [
  // Accessibility-first
  'textarea[aria-label*="search" i]',
  'textarea[aria-label*="ask" i]',
  'textarea[aria-label*="message" i]',
  'textarea[aria-label*="query" i]',

  // Test hooks
  'textarea[data-testid*="search"]',
  'textarea[data-testid*="input"]',
  'textarea[data-testid*="query"]',

  // Placeholder-based
  'textarea[placeholder*="search" i]',
  'textarea[placeholder*="ask" i]',

  // Generic fallbacks
  'textarea',
] as const;

/**
 * Type for textarea selector tuple.
 */
export type TextareaSelector = (typeof TEXTAREA_SELECTORS)[number];

/**
 * Get combined submit button selector string for waitForSelector.
 * @returns CSS selector string with all submit button selectors joined by comma
 */
export function getSubmitButtonSelector(): string {
  return SUBMIT_BUTTON_SELECTORS.join(', ');
}

/**
 * Get combined textarea selector string for waitForSelector.
 * @returns CSS selector string with all textarea selectors joined by comma
 */
export function getTextareaSelector(): string {
  return TEXTAREA_SELECTORS.join(', ');
}
