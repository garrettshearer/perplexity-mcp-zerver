# Implementation Plan: Space Redirect

**Feature Branch**: `001-space-redirect`  
**Spec Path**: `/specs/001-space-redirect/spec.md`  
**Created**: 2026-01-20  
**Status**: Ready for Implementation

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Primary Language** | TypeScript |
| **Runtime** | Node.js |
| **Build Tool** | TypeScript compiler (tsc) |
| **Test Framework** | Vitest |
| **Browser Automation** | Puppeteer |
| **Module System** | ESM with `.js` extensions |

### Existing Patterns Identified

1. **Navigation Pattern**: `openPerplexityChat()` in `src/utils/puppeteer.ts` (Lines 220-274) - navigates to existing chat by ID, validates HTTP response, checks for auth redirects, waits for textarea selector
2. **Tool Schema Pattern**: `TOOL_SCHEMAS` array in `src/schema/toolSchemas.ts` - each tool defines `inputSchema` with optional parameters
3. **Type Definitions**: `src/types/tools.ts` - interfaces for tool arguments (e.g., `ChatPerplexityArgs`, `SearchArgs`)
4. **Test Pattern**: `src/__tests__/unit/chat-redirect.test.ts` - mocks page/context, tests HTTP error codes, auth redirects, selector timeouts

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Test-First | ✅ Will Follow | Tests written before implementation |
| Backwards Compatibility | ✅ FR-007 | Optional `space_id` parameter - existing behavior unchanged |
| Error Handling | ✅ FR-009 | Clear error messages required |
| Input Validation | ✅ FR-010 | Non-empty string validation |

---

## Phase 0: Research Summary

### Decision: URL Format
- **Chosen**: `https://www.perplexity.ai/spaces/{spaceId}`
- **Rationale**: Matches spec FR-002, consistent with existing chat URL pattern
- **Alternatives**: None considered - spec dictates format

### Decision: Selector Strategy  
- **Chosen**: Reuse existing `getSearchInputSelectors()` from `puppeteer-logic.ts`
- **Rationale**: Space pages use same textarea structure as main Perplexity interface
- **Risk Mitigation**: If space has different selector, add space-specific selectors to array

### Decision: Timeout Values
- **Chosen**: 30s navigation timeout (same as `CONFIG.TIMEOUT_PROFILES.navigation`), 10s selector timeout (`CONFIG.SELECTOR_TIMEOUT`)
- **Rationale**: Matches existing `openPerplexityChat()` implementation

---

## Phase 1: Data Model & Contracts

### New Types

```typescript
// src/types/tools.ts - additions

export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  chat_url?: string;
  space_id?: string;  // NEW: Optional space context
}

export interface SearchArgs {
  query: string;
  detail_level?: "brief" | "normal" | "detailed";
  stream?: boolean;
  space_id?: string;  // NEW: Optional space context
}
```

### New Function Contract

```typescript
// src/utils/puppeteer.ts - new export

/**
 * Navigate to a Perplexity Space by ID.
 * Validates the space loads correctly by checking for chat input.
 *
 * @param ctx - The Puppeteer context with initialized page
 * @param spaceId - The space ID to navigate to (non-empty string)
 * @throws Error if:
 *   - Page not initialized
 *   - Space ID is empty/invalid
 *   - Space not found (404)
 *   - Auth redirect detected
 *   - Selector timeout (chat input not found)
 */
export async function openPerplexitySpace(
  ctx: PuppeteerContext,
  spaceId: string
): Promise<void>;
```

---

## Phase 2: Implementation Tasks

### Task 2.1: Add `openPerplexitySpace()` Function
**File**: `src/utils/puppeteer.ts`  
**Estimated Lines**: ~50  
**Pattern Reference**: Copy from `openPerplexityChat()` (Lines 220-274)

**Implementation Steps**:
1. Add input validation: throw if `spaceId` is empty or whitespace
2. Construct URL: `https://www.perplexity.ai/spaces/${spaceId}`
3. Navigate with 30s timeout, `waitUntil: "domcontentloaded"`
4. Check HTTP status: 404 → "Space not found" error
5. Check URL: if not `perplexity.ai` → "Authentication required" error
6. Wait for textarea selector with 10s timeout
7. Log success message

**Acceptance Criteria**:
- [ ] Empty/whitespace `spaceId` throws before navigation attempt
- [ ] 404 response throws "Space not found" with helpful message
- [ ] Auth redirect detected and throws "Authentication required"
- [ ] Selector timeout throws "Space page loaded but input area not found"
- [ ] Success logs space ID

---

### Task 2.2: Update `ChatPerplexityArgs` Type
**File**: `src/types/tools.ts`  
**Estimated Lines**: +1

**Change**:
```typescript
export interface ChatPerplexityArgs {
  message: string;
  chat_id?: string;
  chat_url?: string;
  space_id?: string;  // Add this line
}
```

---

### Task 2.3: Update `SearchArgs` Type
**File**: `src/types/tools.ts`  
**Estimated Lines**: +1

**Change**:
```typescript
export interface SearchArgs {
  query: string;
  detail_level?: "brief" | "normal" | "detailed";
  stream?: boolean;
  space_id?: string;  // Add this line
}
```

---

### Task 2.4: Update `chat_perplexity` Tool Schema
**File**: `src/schema/toolSchemas.ts`  
**Location**: Inside `TOOL_SCHEMAS[0].inputSchema.properties`

**Add Property**:
```typescript
space_id: {
  type: "string",
  description: "Optional: Perplexity Space ID to direct the conversation to a specific space with custom context and knowledge base.",
  examples: ["my-research-space", "project-docs-abc123"],
},
```

---

### Task 2.5: Update `search` Tool Schema
**File**: `src/schema/toolSchemas.ts`  
**Location**: Inside `TOOL_SCHEMAS[5].inputSchema.properties` (search is last tool)

**Add Property**:
```typescript
space_id: {
  type: "string",
  description: "Optional: Perplexity Space ID to perform the search within a specific space context.",
  examples: ["my-research-space", "project-docs-abc123"],
},
```

---

### Task 2.6: Update `chatPerplexity` Tool Implementation
**File**: `src/tools/chatPerplexity.ts`

**Changes**:
1. Destructure `space_id` from args
2. If `space_id` provided AND no existing chat (not `isExistingChat`), navigate to space first
3. Precedence: `chat_url` > `chat_id` > `space_id` (existing chat takes precedence)

**Logic Flow**:
```typescript
// After resolving chat ID logic...
if (!isExistingChat && space_id) {
  await openPerplexitySpace(ctx, space_id);
}
// Then proceed with search as before
```

---

### Task 2.7: Update `search` Tool Implementation
**File**: `src/tools/search.ts`

**Changes**:
1. Add `space_id` to args destructuring
2. If `space_id` provided, navigate to space before performing search

**Logic Flow**:
```typescript
export default async function search(
  args: {
    query: string;
    detail_level?: "brief" | "normal" | "detailed";
    stream?: boolean;
    space_id?: string;  // Add parameter
  },
  ctx: PuppeteerContext,
  performSearch: (prompt: string, ctx: PuppeteerContext) => Promise<string>,
): Promise<string | AsyncGenerator<string, void, unknown>> {
  const { query, detail_level = "normal", stream = false, space_id } = args;
  
  // Navigate to space if specified
  if (space_id) {
    await openPerplexitySpace(ctx, space_id);
  }
  
  // ... rest of existing implementation
}
```

---

## Phase 3: Test Implementation

### Test File 3.1: Unit Tests for `openPerplexitySpace()`
**File**: `src/__tests__/unit/space-redirect.test.ts`  
**Pattern Reference**: Copy structure from `chat-redirect.test.ts`

**Test Cases**:
| Test | Input | Expected |
|------|-------|----------|
| Navigates to correct space URL | Valid space ID | `page.goto` called with `https://www.perplexity.ai/spaces/{id}` |
| Uses 30s navigation timeout | Valid space ID | `timeout: 30000` in goto options |
| Throws on empty space ID | `""` or `"   "` | Error: "Space ID must be non-empty" |
| Throws "Space not found" on 404 | 404 response | Error contains "Space not found" |
| Throws on auth redirect | URL changes to non-perplexity | Error contains "Authentication required" |
| Throws on selector timeout | Selector never found | Error contains "input area not found" |
| Throws on null page | `ctx.page = null` | Error: "Page not initialized" |
| Throws on closed page | `page.isClosed() = true` | Error: "Page not initialized" |
| Logs navigation attempt | Valid space ID | `ctx.log` called with info message |

---

### Test File 3.2: Unit Tests for `chatPerplexity` with `space_id`
**File**: `src/__tests__/unit/tools.test.ts` (extend existing)

**Test Cases**:
| Test | Input | Expected |
|------|-------|----------|
| New chat with space_id navigates to space | `{ message, space_id }` | `openPerplexitySpace` called |
| Existing chat ignores space_id | `{ message, chat_id, space_id }` | `openPerplexityChat` called, NOT `openPerplexitySpace` |
| chat_url takes precedence over space_id | `{ message, chat_url, space_id }` | `openPerplexityChat` called |
| No space_id works as before | `{ message }` | No space navigation |

---

### Test File 3.3: Unit Tests for `search` with `space_id`
**File**: `src/__tests__/unit/tools.test.ts` (extend existing)

**Test Cases**:
| Test | Input | Expected |
|------|-------|----------|
| Search with space_id navigates first | `{ query, space_id }` | `openPerplexitySpace` called before `performSearch` |
| Search without space_id works as before | `{ query }` | No space navigation, direct search |
| Space navigation error propagates | Invalid space_id | Error thrown, search not attempted |

---

## Phase 4: Integration Testing

### Manual E2E Test Scenarios

1. **Happy Path - Space Search**:
   - Input: `{ "query": "summarize the documentation", "space_id": "valid-space-id" }`
   - Expected: Browser navigates to space, search executes within space context

2. **Happy Path - Space Chat**:
   - Input: `{ "message": "what files are in this space?", "space_id": "valid-space-id" }`
   - Expected: New chat created within space context

3. **Error - Invalid Space**:
   - Input: `{ "query": "test", "space_id": "nonexistent-space-123" }`
   - Expected: Clear error message about space not found

4. **Backwards Compatibility**:
   - Input: `{ "query": "what is TypeScript?" }` (no space_id)
   - Expected: Behaves identically to current implementation

---

## Implementation Order (Dependency Graph)

```
┌─────────────────────────────────────────────────────────┐
│  Phase 1: Types & Schemas (no dependencies)             │
├─────────────────────────────────────────────────────────┤
│  Task 2.2: ChatPerplexityArgs type                      │
│  Task 2.3: SearchArgs type                              │
│  Task 2.4: chat_perplexity schema                       │
│  Task 2.5: search schema                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 2: Core Function (depends on types)              │
├─────────────────────────────────────────────────────────┤
│  Task 2.1: openPerplexitySpace() function               │
│  Test 3.1: Unit tests for openPerplexitySpace           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 3: Tool Integration (depends on function)        │
├─────────────────────────────────────────────────────────┤
│  Task 2.6: chatPerplexity tool update                   │
│  Task 2.7: search tool update                           │
│  Test 3.2: chatPerplexity integration tests             │
│  Test 3.3: search integration tests                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Phase 4: E2E Validation                                │
├─────────────────────────────────────────────────────────┤
│  Manual testing with real Perplexity spaces             │
└─────────────────────────────────────────────────────────┘
```

---

## Files Modified Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/utils/puppeteer.ts` | Add function | +50 |
| `src/types/tools.ts` | Add properties | +2 |
| `src/schema/toolSchemas.ts` | Add properties | +10 |
| `src/tools/chatPerplexity.ts` | Add logic | +8 |
| `src/tools/search.ts` | Add logic | +8 |
| `src/__tests__/unit/space-redirect.test.ts` | New file | +150 |
| `src/__tests__/unit/tools.test.ts` | Add tests | +50 |

**Total Estimated Changes**: ~280 lines

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Space page uses different selectors | Low | Medium | Test with real spaces; add fallback selectors |
| Space requires different auth flow | Low | High | Detect auth pages and return actionable error |
| Rate limiting on space navigation | Medium | Low | Use existing retry/recovery mechanisms |
| Perplexity URL structure changes | Low | High | Abstract URL construction; easy to update |

---

## Checklist for Implementation

### Pre-Implementation
- [ ] Create feature branch: `git checkout -b 001-space-redirect`
- [ ] Verify tests pass: `pnpm test`
- [ ] Read existing patterns in referenced files

### Implementation (TDD)
- [ ] Write test for `openPerplexitySpace()` - input validation
- [ ] Implement input validation - make test pass
- [ ] Write test for 404 handling
- [ ] Implement 404 handling - make test pass
- [ ] Continue TDD cycle for all test cases...

### Post-Implementation
- [ ] All tests pass: `pnpm test`
- [ ] No lint errors: `pnpm lint`
- [ ] Build succeeds: `pnpm build`
- [ ] Manual E2E test with real Perplexity space
- [ ] Update spec.md with any discovered edge cases
- [ ] Create PR with spec reference

---

**Plan Status**: ✅ Ready for Implementation  
**Next Step**: Create feature branch and begin TDD cycle with Task 3.1 (write failing tests for `openPerplexitySpace`)
