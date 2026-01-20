# Data Model: Model Switching

**Feature**: 001-model-switching  
**Date**: 2026-01-20

## New Types

### ModelSwitchResult

**File**: `src/types/browser.ts`

```typescript
/**
 * Result of a model switching operation.
 * Used to track success, timing, and state changes.
 */
export interface ModelSwitchResult {
  /** Whether the model switch completed successfully */
  success: boolean;
  
  /** The model that is now selected (normalized name from dropdown) */
  selectedModel: string;
  
  /** The previously selected model, if detected */
  previousModel?: string;
  
  /** Time taken to complete the switch in milliseconds */
  duration: number;
  
  /** Whether the model was already selected (no action taken) */
  wasAlreadySelected?: boolean;
}
```

**Usage Example**:
```typescript
const result = await switchModel(ctx, "Claude 3.5 Sonnet");
// result = {
//   success: true,
//   selectedModel: "Claude 3.5 Sonnet",
//   previousModel: "GPT-4o",
//   duration: 1243,
//   wasAlreadySelected: false
// }
```

---

## Modified Types

### SearchArgs

**File**: `src/types/tools.ts`

```typescript
export interface SearchArgs {
  query: string;
  detail_level?: "brief" | "normal" | "detailed";
  stream?: boolean;
  space_id?: string;
  model?: string;  // NEW: Optional model selection
}
```

### ChatPerplexityArgs

**File**: `src/types/tools.ts`

```typescript
export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  chat_url?: string;
  space_id?: string;
  model?: string;  // NEW: Optional model selection
}
```

---

## Constants

### MODEL_SELECTORS

**File**: `src/utils/puppeteer-logic.ts`

```typescript
/**
 * CSS selector patterns for the Perplexity model selector dropdown.
 * Ordered by specificity: data-testid > aria-label > CSS classes.
 * Multiple selectors provide resilience against UI changes.
 */
export const MODEL_SELECTORS = {
  /** Selectors for the dropdown trigger button */
  trigger: [
    '[data-testid="model-selector"]',
    '[data-testid="model-dropdown-trigger"]',
    '[aria-label*="model" i]',
    'button[class*="ModelSelector"]',
  ],
  
  /** Selectors for the dropdown options container */
  optionsContainer: [
    '[data-testid="model-options"]',
    '[role="listbox"]',
    '[role="menu"]',
  ],
  
  /** Selectors for individual model option items */
  option: [
    '[data-testid="model-option"]',
    '[role="option"]',
    '[role="menuitem"]',
  ],
  
  /** Selector for the currently active/selected model indicator */
  activeIndicator: [
    '[data-testid="active-model"]',
    '[aria-selected="true"]',
    '[class*="selected"]',
  ],
} as const;

export type ModelSelectorType = keyof typeof MODEL_SELECTORS;
```

---

## Helper Functions

### normalizeModelName

```typescript
/**
 * Normalize model name for case-insensitive comparison.
 * Trims whitespace and converts to lowercase.
 * 
 * @param name - Raw model name string
 * @returns Normalized lowercase string
 */
export function normalizeModelName(name: string): string {
  return name.trim().toLowerCase();
}
```

### matchesModelName

```typescript
/**
 * Check if a model option matches the requested model name.
 * Performs case-insensitive partial matching.
 * 
 * @param optionText - Text content from dropdown option
 * @param requestedModel - User-provided model name
 * @returns True if the option matches the requested model
 * 
 * @example
 * matchesModelName("Claude 3.5 Sonnet", "claude 3.5") // true
 * matchesModelName("GPT-4o", "gpt-4o")                // true
 * matchesModelName("Sonar Large", "sonar")           // true
 */
export function matchesModelName(
  optionText: string,
  requestedModel: string
): boolean {
  const normalizedOption = normalizeModelName(optionText);
  const normalizedRequest = normalizeModelName(requestedModel);
  return normalizedOption.includes(normalizedRequest);
}
```

---

## Type Exports

**File**: `src/types/index.ts`

Add to existing exports:
```typescript
export type { ModelSwitchResult } from "./browser.js";
```

---

## Validation Notes

- `model` parameter is optional (undefined = use current model)
- Empty string should be treated as undefined (no switch)
- Model names can contain spaces, numbers, and dots (e.g., "Claude 3.5 Sonnet")
- No special characters expected, but trim whitespace for safety
