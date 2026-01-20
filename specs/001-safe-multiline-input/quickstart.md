# Quickstart: Safe Input for Multiline Prompts

**Feature**: 001-safe-multiline-input  
**Date**: 2026-01-20

---

## Overview

The `sendChatMessage()` function provides a safe way to input text into Perplexity's chat textarea, handling multiline content, special characters, and Unicode correctly.

## Basic Usage

```typescript
import { sendChatMessage } from '../utils/puppeteer.js';

// Simple single-line message
const result = await sendChatMessage(ctx, "What is the capital of France?");

// Multiline message with code
const codeQuery = `Explain this code:
\`\`\`python
def hello():
    print("Hello, World!")
\`\`\``;
const result = await sendChatMessage(ctx, codeQuery);

// Message with special characters
const result = await sendChatMessage(ctx, "Compare <div> vs <span> in HTML");

// Message with Unicode
const result = await sendChatMessage(ctx, "Translate 'Hello' to 日本語 🎌");
```

## With Options

```typescript
// Disable auto-submit (set value only)
const result = await sendChatMessage(ctx, "My query", {
  autoSubmit: false
});
// Then manually submit or perform other actions

// Custom timeouts
const result = await sendChatMessage(ctx, "My query", {
  textareaTimeout: 15000,  // 15 seconds to find textarea
  submitTimeout: 10000     // 10 seconds for submit button
});

// Skip value verification (slightly faster)
const result = await sendChatMessage(ctx, "My query", {
  verifyValue: false
});
```

## Handling Results

```typescript
const result = await sendChatMessage(ctx, message);

if (result.success) {
  console.log(`Message sent successfully`);
  console.log(`Value set: ${result.setValue}`);
  console.log(`Used selector: ${result.textareaSelector}`);
  console.log(`Duration: ${result.durationMs}ms`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

## Error Handling

```typescript
try {
  await sendChatMessage(ctx, message);
} catch (error) {
  if (error.message.includes('Textarea not found')) {
    // Page may not have loaded correctly
    await navigateToPerplexity(ctx);
    await sendChatMessage(ctx, message); // Retry
  } else if (error.message.includes('Submit button')) {
    // May be logged out or UI changed
    console.error('Unable to find submit button');
  }
}
```

## Migration from page.type()

### Before (problematic with newlines)
```typescript
// Old approach - fails with \n characters
await page.type(selector, query, { delay: 30 });
await page.keyboard.press("Enter");
```

### After (safe for all content)
```typescript
// New approach - handles all text correctly
await sendChatMessage(ctx, query);
```

## Integration Points

The function is exported from `src/utils/puppeteer.ts` and should be used wherever text needs to be input into Perplexity's chat interface:

1. `SearchEngine.executeSearch()` - Main search execution
2. `chatPerplexity()` - Chat tool implementation
3. Any future tools that need to send messages

## Selector Fallbacks

The function uses multiple fallback selectors (defined in `puppeteer-logic.ts`):

**Textarea selectors** (in priority order):
1. `textarea[placeholder*="Ask"]`
2. `textarea[placeholder*="Search"]`
3. `textarea.w-full`
4. `textarea[rows="1"]`
5. `[role="textbox"]`
6. `textarea`

**Submit button selectors** (in priority order):
1. `[aria-label*="submit" i]`
2. `[aria-label*="send" i]`
3. `[data-testid*="submit"]`
4. `button[type="submit"]`
5. Class-based fallbacks

This ensures resilience against minor UI changes.
