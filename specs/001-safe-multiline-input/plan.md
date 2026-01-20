# Implementation Plan: Safe Input for Multiline Prompts

**Branch**: `001-safe-multiline-input` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-safe-multiline-input/spec.md`

## Summary

Implement a safe text input method that sets textarea values directly via DOM manipulation instead of simulated keyboard typing, enabling proper handling of multiline prompts containing newlines, special characters, and Unicode. The solution triggers React's synthetic event system to ensure form state updates and submit button enablement.

## Technical Context

**Language/Version**: TypeScript 5.8.3  
**Primary Dependencies**: Puppeteer 24.10.1, puppeteer-extra 3.3.6, puppeteer-extra-plugin-stealth 2.11.2  
**Storage**: N/A (browser automation)  
**Testing**: Vitest 3.2.2 with V8 coverage  
**Target Platform**: Node.js (Bun runtime), macOS/Linux  
**Project Type**: Single project (MCP server)  
**Performance Goals**: Submit button enabled within 5 seconds of setting textarea value (SC-003)  
**Constraints**: Must maintain anti-detection stealth, preserve Cloudflare bypass capability  
**Scale/Scope**: Single utility function used by all chat/search tools

## Constitution Check

*GATE: Pass - No constitution violations detected*

The project uses a template constitution without specific constraints. Standard quality practices apply:
- ✅ Test-first approach will be followed
- ✅ Clear error messages with context
- ✅ Modular design (single function export)
- ✅ No breaking changes to existing API

## Project Structure

### Documentation (this feature)

```text
specs/001-safe-multiline-input/
├── plan.md              # This file
├── research.md          # Phase 0 output ✅
├── data-model.md        # Phase 1 output ✅
├── quickstart.md        # Phase 1 output ✅
├── contracts/           # Phase 1 output ✅
│   └── sendChatMessage.ts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (affected files)

```text
src/
├── utils/
│   ├── puppeteer.ts         # ADD: sendChatMessage() export
│   └── puppeteer-logic.ts   # ADD: getSubmitButtonSelectors(), SUBMIT_BUTTON_SELECTORS
├── server/
│   └── modules/
│       └── SearchEngine.ts  # MODIFY: Replace page.type() with sendChatMessage()
└── __tests__/
    └── unit/
        ├── safe-input.test.ts        # NEW: Unit tests for sendChatMessage
        └── puppeteer-logic.test.ts   # ADD: Tests for new selectors/helpers
```

**Structure Decision**: Single project layout - adding new utility function to existing `puppeteer.ts` with pure logic helpers in `puppeteer-logic.ts` following established patterns.

## Complexity Tracking

> No Constitution violations - section not required

---

## Phase 0: Research (Complete)

See: [research.md](./research.md)

Key decisions:
- **R1**: Dispatch `input` event with `{ bubbles: true, composed: true }`
- **R2**: Use native `HTMLTextAreaElement.prototype.value` setter to bypass React
- **R3**: Prioritized selector array for submit button (aria-label first)
- **R4**: Descriptive errors with selector context

---

## Phase 1: Design (Complete)

See: [data-model.md](./data-model.md) | [quickstart.md](./quickstart.md) | [contracts/](./contracts/)

Key artifacts:
- `SendChatMessageOptions` interface
- `SendChatMessageResult` interface  
- `SUBMIT_BUTTON_SELECTORS` constant
- `sendChatMessage()` function contract

---

## Implementation Tasks (Phase 2 Preview)

### Task 1: Add Types (src/types/browser.ts)
- Add `SendChatMessageOptions` interface
- Add `SendChatMessageResult` interface
- Export from index.ts

### Task 2: Add Selectors (src/utils/puppeteer-logic.ts)
- Add `SUBMIT_BUTTON_SELECTORS` constant
- Add `getSubmitButtonSelectors()` function
- Add unit tests in `puppeteer-logic.test.ts`

### Task 3: Implement sendChatMessage (src/utils/puppeteer.ts)
- Implement `sendChatMessage()` function
- Use `page.$eval()` for direct value setting
- Dispatch input event with bubbles
- Implement submit button detection with fallbacks
- Export from puppeteer.ts

### Task 4: Create Unit Tests (src/__tests__/unit/safe-input.test.ts)
- Test multiline input preservation
- Test special character handling
- Test Unicode/emoji support
- Test React event triggering (mock verification)
- Test submit button fallback selectors
- Test timeout error messages

### Task 5: Integrate into SearchEngine (src/server/modules/SearchEngine.ts)
- Replace `page.type(selector, query, { delay })` with `sendChatMessage()`
- Remove manual keyboard.press('Enter')
- Update error handling

### Task 6: Integration Testing
- Manual verification with real Perplexity page
- Test multiline prompts
- Test code blocks with special characters
- Verify submit button enables and clicks

---

## Acceptance Verification

| Requirement | Test Method | Pass Criteria |
|-------------|-------------|---------------|
| FR-001 | Unit test | `page.$eval` called, not `keyboard.type` |
| FR-002 | Unit test | Input with `\n` has newlines in setValue |
| FR-003 | Unit test | Special chars `'"<>{}[]` preserved |
| FR-004 | Unit test | Event dispatched with bubbles:true |
| FR-005 | Unit test | Multiple selectors tried in order |
| FR-008 | Unit test | Unicode "日本語🎉" preserved |
| SC-001 | Manual E2E | Multiline appears correctly in UI |
| SC-004 | grep search | Zero `keyboard.type` in message paths |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| React event system changes | Fallback to multiple event types |
| Submit button selector breaks | 7+ fallback selectors with logging |
| Cloudflare detects direct value set | Keep stealth plugin, no JS detection |
| Performance regression | Benchmark: should be faster than typed input |

---

## Dependencies

- No new npm packages required
- Uses existing Puppeteer Page APIs
- Follows existing patterns in codebase

---

**Next Step**: Run `/speckit.tasks` to generate detailed task breakdown with file-by-file changes.

