/**
 * API Contract: sendChatMessage
 * Feature: 001-safe-multiline-input
 * 
 * This file defines the contract for the sendChatMessage function.
 * Implementation should match this specification exactly.
 */

import type { PuppeteerContext } from '../../../src/types/index.js';

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────

/**
 * Configuration options for the sendChatMessage function.
 */
export interface SendChatMessageOptions {
  /**
   * Timeout in milliseconds for finding the textarea element.
   * @default CONFIG.SELECTOR_TIMEOUT
   */
  textareaTimeout?: number;

  /**
   * Timeout in milliseconds for the submit button to become visible and enabled.
   * @default 5000
   */
  submitTimeout?: number;

  /**
   * Whether to automatically click the submit button after setting the value.
   * @default true
   */
  autoSubmit?: boolean;

  /**
   * Event types to dispatch after setting the value, in order.
   * @default ['input']
   */
  eventTypes?: ReadonlyArray<'input' | 'change' | 'blur'>;

  /**
   * Whether to verify the value was correctly set before proceeding.
   * @default true
   */
  verifyValue?: boolean;
}

/**
 * Result of the sendChatMessage operation.
 */
export interface SendChatMessageResult {
  /** Whether the operation completed successfully */
  success: boolean;
  
  /** The actual value that was set in the textarea */
  setValue: string;
  
  /** The CSS selector used to find the textarea */
  textareaSelector: string;
  
  /** The CSS selector used to find the submit button (if autoSubmit) */
  submitSelector?: string;
  
  /** Error message if success is false */
  error?: string;
  
  /** Operation duration in milliseconds */
  durationMs?: number;
}

// ─── FUNCTION CONTRACT ────────────────────────────────────────────────

/**
 * Send a chat message to Perplexity by directly setting textarea value.
 * 
 * This method safely handles:
 * - Multiline text (preserves \n characters)
 * - Special characters (quotes, brackets, Unicode)
 * - React controlled component state updates
 * 
 * ## Algorithm
 * 
 * 1. Wait for textarea using prioritized selector list
 * 2. Focus the textarea element
 * 3. Use native HTMLTextAreaElement.prototype.value setter
 * 4. Dispatch 'input' event with bubbles:true to trigger React
 * 5. Optionally verify value was set correctly
 * 6. If autoSubmit: find and click submit button
 * 
 * ## Error Conditions
 * 
 * - Throws if textarea not found within textareaTimeout
 * - Throws if value verification fails (when verifyValue=true)
 * - Throws if submit button not found/enabled within submitTimeout (when autoSubmit=true)
 * 
 * ## Performance
 * 
 * Expected execution time: 100-500ms (much faster than keyboard simulation)
 * 
 * @param ctx - Puppeteer context with initialized page
 * @param message - The message to send (may contain newlines, special chars, Unicode)
 * @param options - Optional configuration
 * @returns Promise<SendChatMessageResult> with operation details
 * 
 * @throws {Error} "Textarea not found: Waited Xms for selectors: ..."
 * @throws {Error} "Value verification failed: expected X, got Y"
 * @throws {Error} "Submit button not found or not enabled within Xms"
 * 
 * @example
 * // Basic usage
 * const result = await sendChatMessage(ctx, "Hello\nWorld");
 * 
 * @example
 * // With options
 * const result = await sendChatMessage(ctx, "Query", { 
 *   autoSubmit: false,
 *   textareaTimeout: 15000 
 * });
 * 
 * @example
 * // Error handling
 * try {
 *   await sendChatMessage(ctx, message);
 * } catch (e) {
 *   if (e.message.includes('Textarea not found')) {
 *     // Handle missing textarea
 *   }
 * }
 */
export type SendChatMessageFn = (
  ctx: PuppeteerContext,
  message: string,
  options?: SendChatMessageOptions
) => Promise<SendChatMessageResult>;

// ─── IMPLEMENTATION REQUIREMENTS ──────────────────────────────────────

/**
 * FR-001: MUST use page.$eval() or equivalent DOM manipulation
 *         MUST NOT use keyboard.type()
 * 
 * FR-002: MUST preserve all newline characters (\n, \r\n)
 * 
 * FR-003: MUST preserve special characters without escaping
 *         Test chars: ' " ` < > { } [ ] \ | & $ # @ !
 * 
 * FR-004: MUST dispatch input event with { bubbles: true }
 * 
 * FR-005: MUST use multiple fallback selectors for submit button
 * 
 * FR-006: MUST wait for submit button to be visible AND clickable
 * 
 * FR-007: MUST throw descriptive error if textarea not found
 * 
 * FR-008: MUST handle Unicode characters (UTF-8 preserved)
 *         Test chars: 日本語 🎉 é ñ
 * 
 * FR-009: MUST verify value was set (when verifyValue=true)
 * 
 * FR-010: MUST be exported from src/utils/puppeteer.ts
 */

// ─── SUCCESS CRITERIA ─────────────────────────────────────────────────

/**
 * SC-001: 100% of prompts with \n transmitted with line breaks preserved
 * SC-002: 100% of special characters transmitted without corruption  
 * SC-003: Submit button clicked within 5 seconds of setting value
 * SC-004: Zero keyboard.type() calls in message input code paths
 * SC-005: Test suite includes 5+ test cases
 * SC-006: Works with 3+ Perplexity UI selector variations
 */
