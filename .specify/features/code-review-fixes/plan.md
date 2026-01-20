# Implementation Plan: Code Review Fixes

**Feature Branch**: `feature/perplexity-enhancements-2026`  
**Spec Reference**: [spec.md](./spec.md)  
**Created**: 2026-01-20  
**Status**: Ready for Implementation

---

## Technical Context

| Aspect | Value | Notes |
|--------|-------|-------|
| **Runtime** | Node.js + Bun | Using Bun for build/run |
| **Language** | TypeScript 5.8.3 | Strict mode enabled |
| **Module System** | ESM | `"type": "module"` in package.json |
| **Bundler** | tsc (direct compilation) | No bundler, direct TypeScript emit |
| **Test Runner** | Vitest | `pnpm test` / `vitest run` |
| **Linter** | Biome | `pnpm lint` |
| **Package Manager** | pnpm | Single package (not monorepo) |
| **MCP SDK Version** | 1.12.3 | @modelcontextprotocol/sdk |
| **Package Version** | 0.3.1 | In package.json |
| **Server Version** | 0.2.0 | Hardcoded in PerplexityServer.ts (MISMATCH) |

---

## Constitution Check

| Requirement | Status | Notes |
|-------------|--------|-------|
| Type safety | ⚠️ VIOLATION | 2 production `as any` casts in flagged files |
| Linter compliance | ✅ OK | Biome configured |
| Test coverage | ✅ OK | Unit tests exist for affected modules |
| Interface contracts | ⚠️ VIOLATION | `IBrowserManager` missing from interface, cast required |

---

## Phase 0: Research Summary

### R1: TypeScript Global Augmentation Pattern
**Decision**: Use ambient module augmentation in `src/types/browser.ts`  
**Rationale**: Already has `declare global { interface Window { chrome: ... } }` pattern. The issue is accessing `window.chrome` before it's defined.  
**Fix Pattern**: Check `typeof window.chrome === "undefined"` then assign to `window.chrome` (not `(window as any).chrome`).

### R2: AsyncGenerator Detection
**Decision**: Use `Symbol.asyncIterator` check  
**Rationale**: Standard ECMAScript way to detect async iterables.  
**Pattern**: `if (result && typeof result[Symbol.asyncIterator] === 'function')`

### R3: Interface Method Access
**Decision**: Add `getPuppeteerContext()` to `IBrowserManager` interface  
**Rationale**: Method already exists on implementation, interface is incomplete.  
**Fix**: Update interface to include the method signature.

### R4: Version Sync Pattern
**Decision**: Import version from package.json at build time  
**Rationale**: TypeScript supports `resolveJsonModule`. Single source of truth.  
**Pattern**: `import pkg from "../package.json" assert { type: "json" };`

### R5: SearchResult Return Type
**Decision**: Define `SearchResult` interface with `{ answer, url, citations }`  
**Rationale**: FR-010 requires structured return. URL enables chat_id functionality.  
**Implementation**: Return URL from page after search completes.

---

## Phase 1: Implementation Tasks

### Task 1: Fix IBrowserManager Interface (Type Safety)
**Priority**: P1 (Blocking)  
**File**: `src/types/browser.ts`  
**Requirements**: FR-002

**Changes**:
```typescript
// IBrowserManager interface already has getPuppeteerContext() at line 144
// Interface is CORRECT - verify no changes needed
```

**Verification**: Interface already declares `getPuppeteerContext(): PuppeteerContext` at line 144.

---

### Task 2: Remove `as any` Cast in PerplexityServer.ts
**Priority**: P1  
**File**: `src/server/PerplexityServer.ts`  
**Requirements**: FR-001, FR-004  
**Line**: 171

**Current Code**:
```typescript
private createPuppeteerContext() {
  const browserManager = this.browserManager as any; // Access the getPuppeteerContext method
  return browserManager.getPuppeteerContext();
}
```

**Target Code**:
```typescript
private createPuppeteerContext() {
  return this.browserManager.getPuppeteerContext();
}
```

**Why It Works**: `IBrowserManager` interface already declares `getPuppeteerContext(): PuppeteerContext`. The cast was unnecessary.

**Tests Required**: None (type-only change, compile verification)

---

### Task 3: Fix window.chrome Type in login.ts
**Priority**: P1  
**File**: `src/login.ts`  
**Requirements**: FR-003  
**Line**: 35

**Current Code**:
```typescript
if (typeof window.chrome === "undefined") {
  (window as any).chrome = {
    // ... chrome object properties
  };
}
```

**Target Code**:
```typescript
if (typeof window.chrome === "undefined") {
  window.chrome = {
    // ... chrome object properties
  };
}
```

**Why It Works**: Global augmentation in `src/types/browser.ts` (lines 6-65) already declares `Window.chrome` interface. The browser.ts types file needs to be imported (or referenced via tsconfig) for the types to apply.

**Prerequisite**: Ensure `src/types/browser.ts` is included in tsconfig compilation.

**Tests Required**: Compile verification via `pnpm build`

---

### Task 4: Implement AsyncGenerator Detection in toolHandlerSetup.ts
**Priority**: P1  
**File**: `src/server/toolHandlerSetup.ts`  
**Requirements**: FR-005, FR-006, FR-007, FR-009

**Current Code** (lines 44-58):
```typescript
if (toolHandlers[name]) {
  const result = await toolHandlers[name](args || {});

  // Special case for chat to return chat_id
  if (name === "chat_perplexity") {
    const chatArgs = (args || {}) as unknown as ChatPerplexityArgs;
    const chatId = chatArgs.chat_id || crypto.randomUUID();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ chat_id: chatId, response: result }, null, 2),
        },
      ],
    };
  }

  return { content: [{ type: "text", text: result }] };
}
```

**Target Code**:
```typescript
if (toolHandlers[name]) {
  const result = await toolHandlers[name](args || {});

  // Handle AsyncGenerator streaming results (FR-005, FR-006, FR-007)
  let finalResult: string;
  if (result && typeof (result as AsyncGenerator<string>)[Symbol.asyncIterator] === 'function') {
    // Accumulate all chunks from the async generator
    const chunks: string[] = [];
    for await (const chunk of result as AsyncGenerator<string>) {
      chunks.push(chunk);
    }
    finalResult = chunks.join('');
  } else {
    finalResult = result as string;
  }

  // Special case for chat to return chat_id (FR-012)
  if (name === "chat_perplexity") {
    const chatArgs = (args || {}) as unknown as ChatPerplexityArgs;
    // NOTE: chat_id should come from search result URL per FR-011, FR-012
    // This will be updated in Task 6 when SearchResult type is implemented
    const chatId = chatArgs.chat_id || crypto.randomUUID();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ chat_id: chatId, response: finalResult }, null, 2),
        },
      ],
    };
  }

  return { content: [{ type: "text", text: finalResult }] };
}
```

**Tests Required**:
- Unit test: `AsyncGenerator` detection with mock generator
- Unit test: Chunk accumulation verification
- Unit test: Non-generator passthrough

---

### Task 5: Define SearchResult Type
**Priority**: P2  
**File**: `src/types/tools.ts`  
**Requirements**: FR-010

**Add New Interface**:
```typescript
// ─── SEARCH RESULT TYPE ───────────────────────────────────────────────
/**
 * Result of a search operation including metadata.
 * Used by SearchEngine.performSearch() to return structured data.
 */
export interface SearchResult {
  /** The extracted answer text */
  answer: string;
  /** The Perplexity page URL (canonical chat_id) */
  url: string;
  /** Extracted citation URLs from the answer */
  citations: string[];
}
```

**Export from index.ts**: Add `SearchResult` to exports.

---

### Task 6: Update SearchEngine.performSearch() Return Type
**Priority**: P2  
**File**: `src/server/modules/SearchEngine.ts`  
**Requirements**: FR-010

**Current Signature** (line 14):
```typescript
async performSearch(query: string): Promise<string>
```

**Target Signature**:
```typescript
async performSearch(query: string): Promise<SearchResult>
```

**Implementation Changes**:
1. Capture page URL after search completes
2. Extract citations from answer text
3. Return `{ answer, url, citations }`

**Key Code Changes** (in `performSearch` method):
```typescript
// After extracting answer, get current URL
const currentUrl = this.browserManager.getPage()?.url() ?? '';

// Extract citation URLs from answer (already being captured in extractCompleteAnswer)
const citationRegex = /https?:\/\/[^\s\)]+/g;
const citations = (answer.match(citationRegex) || []).filter(url => !url.includes('perplexity.ai'));

return {
  answer,
  url: currentUrl,
  citations,
};
```

**Cascading Changes Required**:
- Update `ISearchEngine` interface in `src/types/tools.ts`
- Update all callers of `performSearch()` to handle `SearchResult`
- Update `PerplexityServer.ts` methods that call `searchEngine.performSearch()`

---

### Task 7: Update ISearchEngine Interface
**Priority**: P2  
**File**: `src/types/tools.ts`  
**Requirements**: FR-010

**Current**:
```typescript
export interface ISearchEngine {
  performSearch(query: string): Promise<string>;
}
```

**Target**:
```typescript
export interface ISearchEngine {
  performSearch(query: string): Promise<SearchResult>;
}
```

---

### Task 8: Remove UUID Generation in chatPerplexity.ts
**Priority**: P2  
**File**: `src/tools/chatPerplexity.ts`  
**Requirements**: FR-011, FR-012

**Current Code** (lines 45-47):
```typescript
} else {
  // New conversation - generate fresh UUID
  resolvedChatId = crypto.randomUUID();
  isExistingChat = false;
}
```

**Analysis**: The chat_id should come from the search result URL per FR-012. However, this requires:
1. `performSearch()` returning `SearchResult` with URL
2. The caller (PerplexityServer) extracting URL from result

**Deferred**: This task depends on Task 6 completion. The chat tool implementation itself may not need changes if the calling code handles URL extraction.

**Alternative Approach**: Return placeholder, let PerplexityServer inject real URL from search result.

---

### Task 9: Update PerplexityServer Callers
**Priority**: P2  
**File**: `src/server/PerplexityServer.ts`  
**Requirements**: FR-010, FR-012

**Affected Methods**:
- `handleChatPerplexity()` - lines 90-118
- `handleGetDocumentation()` - lines 120-126
- `handleFindApis()` - lines 128-134
- `handleCheckDeprecatedCode()` - lines 136-143
- `handleSearch()` - lines 145-155

**Pattern**: Change from `const result = await this.searchEngine.performSearch(...)` to:
```typescript
const { answer, url, citations } = await this.searchEngine.performSearch(...);
```

For `handleChatPerplexity`, use `url` as the `chat_id` in the response.

---

### Task 10: Sync Server Version with package.json
**Priority**: P3  
**File**: `src/server/PerplexityServer.ts`  
**Requirements**: FR-015, FR-016

**Current Code** (line 33):
```typescript
this.server = new Server(
  { name: "perplexity-server", version: "0.2.0" },
  ...
);
```

**Target Code**:
```typescript
// At top of file, add import:
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

// In constructor:
this.server = new Server(
  { name: "perplexity-server", version: pkg.version },
  ...
);
```

**Alternative (TypeScript resolveJsonModule)**:
If `tsconfig.json` has `"resolveJsonModule": true`:
```typescript
import pkg from "../../package.json" with { type: "json" };
// Then use pkg.version
```

**Tests Required**: 
- Verify server initialization logs correct version
- Verify MCP `initialize` response contains matching version

---

## Phase 2: Verification Tasks

### V1: TypeScript Compilation
```bash
pnpm build
```
**Expected**: Zero errors, zero `as any` in flagged files

### V2: Lint Check
```bash
pnpm lint
```
**Expected**: Clean, no new errors

### V3: Unit Tests
```bash
pnpm test:run
```
**Expected**: All existing tests pass, new tests for streaming accumulation

### V4: Manual Verification - Streaming
1. Start server: `pnpm start`
2. Call search tool with `stream: true`
3. Verify complete accumulated text response (not generator object)

### V5: Manual Verification - Version Sync
1. Check `package.json` version
2. Make MCP `initialize` request
3. Verify `serverInfo.version` matches

### V6: Manual Verification - Chat ID
1. Call `chat_perplexity` with new message
2. Verify returned `chat_id` is a Perplexity URL
3. Open URL in browser - should show conversation

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1a: Type Safety (No Breaking Changes)                     │
├─────────────────────────────────────────────────────────────────┤
│ Task 2: Remove as any in PerplexityServer.ts                    │
│ Task 3: Fix window.chrome in login.ts                           │
│ Task 10: Sync server version                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1b: Streaming Implementation (Isolated Change)            │
├─────────────────────────────────────────────────────────────────┤
│ Task 4: AsyncGenerator detection in toolHandlerSetup.ts         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1c: SearchResult Refactor (Breaking Interface Change)     │
├─────────────────────────────────────────────────────────────────┤
│ Task 5: Define SearchResult type                                │
│ Task 7: Update ISearchEngine interface                          │
│ Task 6: Update SearchEngine.performSearch()                     │
│ Task 9: Update PerplexityServer callers                         │
│ Task 8: Remove UUID generation (depends on Task 6)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Verification                                           │
├─────────────────────────────────────────────────────────────────┤
│ V1: pnpm build                                                  │
│ V2: pnpm lint                                                   │
│ V3: pnpm test:run                                               │
│ V4-V6: Manual verification                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SearchResult refactor breaks existing tests | Medium | High | Run tests after each file change |
| URL extraction fails on some pages | Medium | Medium | Fallback to empty string, log warning |
| Streaming accumulation changes response timing | Low | Medium | Existing tests cover non-streaming path |
| Version import pattern varies by runtime | Low | Low | Use createRequire() for compatibility |

---

## Acceptance Criteria Checklist

- [ ] **SC-001**: Zero `as any` in PerplexityServer.ts line 171
- [ ] **SC-001**: Zero `as any` in login.ts line 35
- [ ] **SC-002**: `pnpm build` succeeds with no type errors
- [ ] **SC-003**: Streaming search returns accumulated text
- [ ] **SC-004**: New chat sessions return Perplexity URL as chat_id
- [ ] **SC-005**: Server version matches package.json (0.3.1)
- [ ] **SC-006**: All existing tests pass
- [ ] **SC-007**: Chat resumption works with URL-based chat_id

---

## Files Modified Summary

| File | Changes | Priority |
|------|---------|----------|
| `src/server/PerplexityServer.ts` | Remove `as any`, version sync, SearchResult handling | P1/P3 |
| `src/login.ts` | Remove `(window as any).chrome` cast | P1 |
| `src/server/toolHandlerSetup.ts` | AsyncGenerator detection and accumulation | P1 |
| `src/types/tools.ts` | Add SearchResult, update ISearchEngine | P2 |
| `src/types/index.ts` | Export SearchResult | P2 |
| `src/server/modules/SearchEngine.ts` | Return SearchResult with URL | P2 |
| `src/tools/chatPerplexity.ts` | Remove UUID (if needed after refactor) | P2 |

---

**Plan Status**: ✅ Complete - Ready for Implementation  
**Estimated Effort**: 2-3 hours  
**Next Step**: Begin Phase 1a (Type Safety fixes)
