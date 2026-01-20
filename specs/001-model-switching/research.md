# Research: Model Switching

**Feature**: 001-model-switching  
**Date**: 2026-01-20  
**Status**: In Progress

## Research Tasks

### R01: Perplexity UI Selectors for Model Dropdown

**Status**: NEEDS INSPECTION

**Task**: Identify the CSS selectors used by Perplexity's model selector dropdown.

**Method**: 
1. Open Perplexity in browser with DevTools
2. Inspect the model dropdown trigger button
3. Document data-testid, aria-label, class names
4. Inspect dropdown options container
5. Document option item selectors

**Preliminary Selectors** (to be validated):
```typescript
// These need validation against live Perplexity UI
const MODEL_SELECTORS_DRAFT = {
  trigger: [
    // High priority: data-testid attributes
    '[data-testid="model-selector"]',
    '[data-testid="model-dropdown-trigger"]',
    // Medium priority: ARIA labels
    '[aria-label*="model" i]',
    '[aria-label*="AI model" i]',
    // Low priority: Class-based (fragile)
    'button[class*="ModelSelector"]',
    'button[class*="model-selector"]',
    'div[class*="model-dropdown"]',
  ],
  optionsContainer: [
    '[data-testid="model-options"]',
    '[role="listbox"]',
    '[role="menu"]',
    'div[class*="dropdown-menu"]',
    'ul[class*="model-options"]',
  ],
  option: [
    '[data-testid="model-option"]',
    '[role="option"]',
    '[role="menuitem"]',
    'li[class*="model-option"]',
    'div[class*="model-item"]',
  ],
};
```

**Findings**: _To be populated after UI inspection_

---

### R02: Available Perplexity Pro Models

**Status**: NEEDS VERIFICATION

**Task**: Document the AI models available in Perplexity Pro.

**Known Models** (from spec + general knowledge):
| Model Name | Provider | Notes |
|------------|----------|-------|
| Claude 3.5 Sonnet | Anthropic | Strong reasoning |
| GPT-4o | OpenAI | General purpose |
| Sonar | Perplexity | Native, search-optimized |
| Sonar Large | Perplexity | Larger variant |
| Claude 3 Opus | Anthropic | Most capable Claude |
| GPT-4 Turbo | OpenAI | Previous gen |

**Verification Method**: Check dropdown options in live Perplexity UI

**Findings**: _To be populated after UI inspection_

---

### R03: Dropdown Interaction Pattern

**Status**: NEEDS TESTING

**Task**: Document how the model dropdown behaves (click flow, async loading, animations).

**Questions to Answer**:
1. Does clicking the trigger button open immediately or with animation?
2. Are options loaded dynamically (network request) or pre-rendered?
3. Is there a visible loading state?
4. Does clicking outside close the dropdown?
5. Is there keyboard navigation support (arrow keys, Enter)?
6. What happens when selecting the already-active model?

**Expected Pattern** (based on common dropdown implementations):
```
1. Click trigger button
2. Wait for dropdown to open (may have fade-in animation)
3. Wait for options to render (may be async)
4. Click target option
5. Dropdown closes automatically
6. Model indicator updates to show new selection
```

**Findings**: _To be populated after UI testing_

---

### R04: Existing Selector Fallback Patterns

**Status**: ✅ RESOLVED

**Source**: `src/utils/puppeteer-logic.ts`

**Pattern Found**:
```typescript
export function getSearchInputSelectors(): string[] {
  return [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Search"]',
    'textarea[data-testid="query-input"]',
    '#query-input',
    '.search-input textarea',
  ];
}
```

**Decision**: Apply same pattern for MODEL_SELECTORS:
- Return array of selectors ordered by specificity
- Use `page.waitForSelector(selectors.join(', '))` for OR matching
- Log which selector matched for debugging

---

## Decisions Made

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Use selector array with fallbacks | Resilience against UI changes | Single selector (too fragile) |
| Case-insensitive matching | User convenience (spec FR-003) | Exact match only |
| First match wins for partial names | Deterministic behavior | Error on ambiguous matches |
| 5-second timeout for options | Balance UX and reliability | 3s (too short), 10s (too long) |

---

## Open Questions

1. **Q**: Does Perplexity require Pro subscription for model switching?
   - **Impact**: May need to handle non-Pro users gracefully
   - **Action**: Test with free account

2. **Q**: Are there per-model rate limits?
   - **Impact**: May need to add rate limit handling
   - **Action**: Monitor for 429 responses

3. **Q**: Does model selection persist across sessions?
   - **Impact**: Affects default model behavior
   - **Action**: Test session persistence

---

## Next Steps

1. [ ] Open Perplexity in browser, login to Pro account
2. [ ] Use DevTools to inspect model selector element
3. [ ] Document actual selectors in R01
4. [ ] List all available models in R02
5. [ ] Test dropdown interaction flow for R03
6. [ ] Update `plan.md` with final selector strategy
