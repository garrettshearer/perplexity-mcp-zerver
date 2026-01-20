# Data Model: Safe Input for Multiline Prompts

**Feature**: 001-safe-multiline-input  
**Date**: 2026-01-20  
**Status**: Complete

---

## Type Definitions

Add to `src/types/browser.ts` or create `src/types/input.ts`:

```typescript
// ─── SAFE INPUT TYPES ─────────────────────────────────────────────────

/**
 * Configuration options for the sendChatMessage function.
 * All options have sensible defaults and are optional.
 */
export interface SendChatMessageOptions {
  /**
   * Timeout in milliseconds for finding the textarea element.
   * @default CONFIG.SELECTOR_TIMEOUT (typically 10000)
   */
  textareaTimeout?: number;

  /**
   * Timeout in milliseconds for the submit button to become visible and enabled.
   * @default 5000
   */
  submitTimeout?: number;

  /**
   * Whether to automatically click the submit button after setting the value.
   * Set to false if you need to perform additional actions before submission.
   * @default true
   */
  autoSubmit?: boolean;

  /**
   * Event types to dispatch after setting the value, in order.
   * Used as fallbacks if the primary event doesn't trigger React.
   * @default ['input']
   */
  eventTypes?: ReadonlyArray<'input' | 'change' | 'blur'>;

  /**
   * Whether to verify the value was correctly set before proceeding.
   * Adds a small overhead but ensures data integrity.
   * @default true
   */
  verifyValue?: boolean;
}

/**
 * Result of the sendChatMessage operation.
 * Provides detailed information about what happened for debugging.
 */
export interface SendChatMessageResult {
  /**
   * Whether the message was successfully set (and submitted if autoSubmit=true).
   */
  success: boolean;

  /**
   * The actual value that was set in the textarea.
   * Use this to verify the message was transmitted correctly.
   */
  setValue: string;

  /**
   * The CSS selector that was used to find the textarea.
   * Useful for debugging selector issues.
   */
  textareaSelector: string;

  /**
   * The CSS selector that was used to find the submit button.
   * Only present if autoSubmit was true.
   */
  submitSelector?: string;

  /**
   * Error message if success is false.
   * Contains detailed context about what failed.
   */
  error?: string;

  /**
   * Time taken for the operation in milliseconds.
   * Useful for performance monitoring.
   */
  durationMs?: number;
}
```

---

## Selector Constants

Add to `src/utils/puppeteer-logic.ts`:

```typescript
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
] as const;

/**
 * Type for submit button selector tuple.
 */
export type SubmitButtonSelector = typeof SUBMIT_BUTTON_SELECTORS[number];
```

---

## Entity Relationships

```
┌─────────────────────────┐
│   PuppeteerContext      │
│  (existing type)        │
├─────────────────────────┤
│ - page: Page            │
│ - browser: Browser      │
│ - log: function         │
└───────────┬─────────────┘
            │
            │ used by
            ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  sendChatMessage()      │────▶│ SendChatMessageResult   │
│                         │     │                         │
│ Parameters:             │     │ - success: boolean      │
│ - ctx: PuppeteerContext │     │ - setValue: string      │
│ - message: string       │     │ - textareaSelector      │
│ - options?: Options     │     │ - submitSelector?       │
└───────────┬─────────────┘     │ - error?                │
            │                   │ - durationMs?           │
            │                   └─────────────────────────┘
            │ configurable via
            ▼
┌─────────────────────────┐
│ SendChatMessageOptions  │
├─────────────────────────┤
│ - textareaTimeout?      │
│ - submitTimeout?        │
│ - autoSubmit?           │
│ - eventTypes?           │
│ - verifyValue?          │
└─────────────────────────┘
```

---

## Validation Rules

### Message Input
- **Type**: string
- **Required**: Yes
- **Constraints**: 
  - May contain any Unicode characters
  - May contain newline characters (`\n`, `\r\n`)
  - May be empty string (Perplexity will handle validation)
  - No maximum length enforced (Perplexity UI limits apply)

### Timeout Values
- **Type**: number (milliseconds)
- **Constraints**:
  - Must be positive integer
  - Recommended minimum: 1000ms
  - Recommended maximum: 60000ms
  - Default textareaTimeout: CONFIG.SELECTOR_TIMEOUT
  - Default submitTimeout: 5000ms

### Event Types Array
- **Type**: Array of 'input' | 'change' | 'blur'
- **Constraints**:
  - At least one event type required
  - Order determines dispatch sequence
  - Default: `['input']`

---

## State Transitions

```
┌──────────────┐
│    INIT      │
└──────┬───────┘
       │ findTextarea()
       ▼
┌──────────────┐
│TEXTAREA_FOUND│──────────┐
└──────┬───────┘          │
       │ setValue()       │ timeout
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ VALUE_SET    │   │   ERROR      │
└──────┬───────┘   │ (not found)  │
       │           └──────────────┘
       │ verifyValue (if enabled)
       ▼
┌──────────────┐
│VALUE_VERIFIED│──────────┐
└──────┬───────┘          │
       │ autoSubmit?      │ verify failed
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ FINDING_BTN  │   │   ERROR      │
└──────┬───────┘   │ (mismatch)   │
       │           └──────────────┘
       │ findSubmitButton()
       ▼
┌──────────────┐
│ BUTTON_FOUND │──────────┐
└──────┬───────┘          │
       │ click()          │ timeout
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│   SUCCESS    │   │   ERROR      │
└──────────────┘   │ (no button)  │
                   └──────────────┘
```

---

## Export Updates

### src/types/index.ts
```typescript
// Add to existing exports
export type { SendChatMessageOptions, SendChatMessageResult } from './browser.js';
```

### src/utils/puppeteer-logic.ts
```typescript
// Add to existing exports
export { SUBMIT_BUTTON_SELECTORS, getSubmitButtonSelectors } from './puppeteer-logic.js';
```

### src/utils/puppeteer.ts
```typescript
// Add to existing exports
export { sendChatMessage } from './puppeteer.js';
```
