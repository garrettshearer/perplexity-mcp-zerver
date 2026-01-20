# Research: Safe Input for Multiline Prompts

**Feature**: 001-safe-multiline-input  
**Date**: 2026-01-20  
**Status**: Complete

---

## R1: React Event System Integration

### Decision
Dispatch `input` event with `{ bubbles: true, composed: true }` after setting value directly on the textarea element.

### Rationale
React 18+ uses event delegation - synthetic events are attached to the root container, not individual elements. For the textarea's onChange handler to fire:

1. The DOM `input` event must bubble up to the root
2. React's event system must recognize the value change
3. The component's internal state must update

Setting `bubbles: true` ensures the event propagates up the DOM tree. Setting `composed: true` allows the event to cross shadow DOM boundaries (future-proofing).

### Research Sources
- React Event Delegation: Events are attached to the root, not elements
- Native setter requirement: React overrides `.value` setter for controlled components
- InputEvent vs Event: Basic `Event` with type 'input' is sufficient and more compatible

### Alternatives Considered
| Alternative | Reason Rejected |
|-------------|-----------------|
| Dispatch `change` event only | React listens primarily for `input` on textareas |
| Use `InputEvent` constructor | Less browser support, `Event` is sufficient |
| Multiple events (focus, input, change, blur) | Reserved as fallback if primary fails |
| `document.execCommand('insertText')` | Deprecated API, inconsistent behavior |

---

## R2: Value Setter Bypass Pattern

### Decision
Use `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` to access the native DOM setter, bypassing React's controlled component wrapper.

### Rationale
React's controlled components intercept the `.value` setter to maintain state synchronization. Direct assignment `el.value = text` may:
- Not trigger React's internal state update
- Leave the component in an inconsistent state
- Prevent the form from recognizing input

Using the native setter from the prototype chain ensures:
1. The DOM value is actually updated
2. React's synthetic event dispatch can detect the change
3. Form validation and submit button state update correctly

### Implementation Pattern
```javascript
await page.$eval(selector, (textarea, text) => {
  // Get the native HTMLTextAreaElement value setter
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 
    'value'
  )?.set;
  
  // Use native setter to bypass React's controlled component wrapper
  if (nativeValueSetter) {
    nativeValueSetter.call(textarea, text);
  } else {
    // Fallback: direct assignment (may not trigger React)
    textarea.value = text;
  }
  
  // Dispatch input event to notify React of the change
  textarea.dispatchEvent(new Event('input', { 
    bubbles: true, 
    composed: true 
  }));
}, message);
```

### Alternatives Considered
| Alternative | Reason Rejected |
|-------------|-----------------|
| Direct `el.value = text` | Won't trigger React state updates |
| Clipboard paste simulation | Requires permissions, slower, may trigger paste handlers |
| `execCommand('insertText')` | Deprecated, inconsistent across browsers |
| Simulate individual keystrokes | Original problem - fails with newlines |

---

## R3: Submit Button Selector Strategy

### Decision
Use a prioritized array of selectors targeting accessibility attributes first, with fallbacks to class-based and structural selectors.

### Rationale
Perplexity's UI is subject to change, but:
- Accessibility attributes (`aria-label`) are more stable (a11y requirements)
- Test IDs (`data-testid`) are intentionally stable for testing
- Class names change frequently with CSS-in-JS solutions
- Structural selectors (button type) are standards-based

### Selector Priority Order
```typescript
export const SUBMIT_BUTTON_SELECTORS = [
  // Accessibility-first (most stable)
  '[aria-label*="submit" i]',      // P1: aria-label containing "submit"
  '[aria-label*="send" i]',        // P2: aria-label containing "send"
  '[aria-label*="Submit" i]',      // P3: capitalized variant
  '[aria-label*="Send" i]',        // P4: capitalized variant
  
  // Test hooks (intentionally stable)
  '[data-testid*="submit"]',
  '[data-testid*="send"]',
  
  // Semantic HTML (standards-based)
  'button[type="submit"]',
  
  // Class-based (least stable, last resort)
  'button[class*="submit"]',
  'button[class*="send"]',
] as const;
```

### Detection Strategy
1. Wait for any selector to match using `page.waitForSelector(selectorArray.join(', '))`
2. Find which specific selector matched
3. Verify button is visible and enabled
4. Click with retry on failure

---

## R4: Error Handling Strategy

### Decision
Throw descriptive errors with:
- Which operation failed
- What selector(s) were tried
- How long we waited
- Current page state hint

### Rationale
Debugging browser automation failures is difficult without context. Descriptive errors enable:
- Self-service debugging by users
- Faster issue triage
- Better error reporting in logs

### Error Message Templates
```typescript
// Textarea not found
`Textarea not found within ${timeout}ms. Tried selectors: ${selectors.join(', ')}. ` +
`Current URL: ${await page.url()}. The page may not have loaded correctly.`

// Submit button not found
`Submit button not found or not enabled within ${timeout}ms. ` +
`Tried selectors: ${selectors.join(', ')}. ` +
`This may indicate a login wall or changed UI.`

// Value set failed
`Failed to set textarea value: ${error.message}. ` +
`The textarea may be read-only or the page structure has changed.`

// Submit failed
`Failed to submit message: ${error.message}. ` +
`The button may have been disabled or the page navigated away.`
```

---

## R5: Existing Codebase Patterns

### Current Input Method (to replace)
Location: `src/server/modules/SearchEngine.ts:122`
```typescript
const typeDelay = Math.floor(Math.random() * 20) + 20; // 20-40ms
await page.type(selector, query, { delay: typeDelay });
await page.keyboard.press("Enter");
```

**Issues with current approach**:
- `page.type()` simulates keystrokes - fails with `\n` characters
- Slow for long messages (20-40ms per character)
- Anti-detection delay unnecessary for direct value setting

### Existing Selector Patterns
Location: `src/utils/puppeteer-logic.ts`
- `getSearchInputSelectors()` - returns array of textarea selectors
- `MODEL_SELECTORS` - prioritized selector object pattern
- `RESEARCH_MODE_SELECTORS` - similar multi-fallback pattern

### Existing Test Patterns
Location: `src/__tests__/unit/puppeteer-logic.test.ts`
- Mock Page objects with vi.fn()
- Test selector arrays for completeness
- Test pure logic functions without Puppeteer mocks

---

## Summary: Research Complete

All unknowns have been resolved:

| Item | Resolution |
|------|------------|
| How to trigger React state | Native setter + input event with bubbles |
| How to bypass controlled component | `HTMLTextAreaElement.prototype.value` setter |
| Submit button detection | Priority selector array, a11y-first |
| Error handling | Descriptive messages with context |
| Integration point | Replace `page.type()` in SearchEngine.ts |

**Ready for Phase 1: Design & Contracts**
