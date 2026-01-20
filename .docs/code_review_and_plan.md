<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# do a full code review of my repo at https://github.com/garrettshearer/perplexity-mcp-zerver

A true “full” code review isn’t possible from a single pass without loading every file (tests, schemas, utils, config, CI, etc.), but a solid architectural review can be done from the key runtime modules and entrypoints that were inspected (server, browser/search modules, tool wiring, and scripts).

## What’s strong

- The server is structured around small modules (`BrowserManager`, `SearchEngine`, `DatabaseManager`) and dependency injection via `ServerDependencies`, which is a good foundation for testability and swapping implementations.
- The MCP tool dispatch is centralized in `toolHandlerSetup.ts` and uses a registry pattern, which keeps tool wiring relatively clean and makes it easy to add tools.
- `SearchEngine` includes retries, recovery hooks, and fallbacks (including a “try to extract any content” fallback path), which is pragmatic for brittle browser automation.


## Correctness / consistency issues

- Version mismatch: `package.json` is `0.3.1`, but the MCP server identifies itself as `{ name: "perplexity-server", version: "0.2.0" }` inside `PerplexityServer`. This will confuse debugging and downstream clients; consider deriving it from `package.json` at build time or keeping them in sync.
- `PerplexityServer.handleExtractUrlContent()` uses `const browserManager = this.browserManager as any` to call `getPuppeteerContext()`, which suggests `IBrowserManager` doesn’t declare that method even though `BrowserManager` implements it. Promote that method into the interface to avoid unsafe casts and “it compiles but breaks at runtime” risks if implementations diverge.
- Chat ID handling looks inconsistent: `toolHandlerSetup.ts` generates a `chat_id` if missing, but it does that *after* invoking the handler, and the handler (`handleChatPerplexity`) passes the original args into `chatPerplexity`. This can lead to “response returns chat_id X but the DB stored messages under chat_id Y/undefined” depending on how `chatPerplexity` behaves. Generate/inject `chat_id` up front and pass it into the handler so storage + return value are aligned.
- `BrowserManager.lastSearchTime` is `readonly` and initialized to `0`, and it’s exposed in the `PuppeteerContext` without any setter, so anything relying on it for idling/recovery heuristics won’t work as intended. Either remove it or make it real state that updates per request.


## Security / operational risks

- `login.ts` launches Chromium with `--disable-web-security` and `--disable-features=IsolateOrigins,site-per-process`, which is understandable for debugging but materially reduces browser isolation. If this is meant to be used by others, add prominent warnings and consider gating behind an explicit `--i-accept-insecure-browser-flags` style CLI switch.
- URL scheme filtering in `SearchEngine.extractCompleteAnswer()` uses a blocklist with `href.startsWith(...)` and doesn’t normalize case/whitespace; it’s easy to bypass with uppercase schemes or leading whitespace. Prefer a normalized check (e.g., `href.trim()` + case-insensitive regex like `/^(javascript|data|vbscript):/i`) and consider rejecting non-http(s) schemes explicitly.
- Debug screenshots write to fixed filenames like `debug_search_input_not_found.png` / `debug_prose_not_found.png`. In long-running servers or multi-process environments, that can overwrite previous evidence or fail on read-only filesystems; consider a timestamped path, configurable debug directory, or feature-flagged tracing.


## Tool API / behavior mismatches

- `src/tools/search.ts` is written to optionally return an `AsyncGenerator` for “real streaming”, but the MCP server path (`PerplexityServer.handleSearch`) calls `this.searchEngine.performSearch(...)` and returns a plain string, and `toolHandlerSetup.ts` serializes tool results as text immediately. If streaming is a goal, the server/tool-handler layer needs a streaming-aware transport contract; otherwise, it’s dead complexity that will confuse maintainers.
- `login.ts` uses plain `puppeteer`, while the dependencies include `puppeteer-extra` + stealth plugin. That inconsistency increases “works in login, fails in server” style issues—consider consolidating the browser stack so evasion behavior matches across flows.


## High-impact next fixes

- Make `chat_id` deterministic by generating it once in the request handler and passing it through the entire call path (DB write + response).
- Remove `as any` casts by aligning interfaces (`IBrowserManager` should include `getPuppeteerContext()` if the server depends on it).
- Decide whether streaming is supported end-to-end; if not, simplify `src/tools/search.ts` to avoid maintaining two paradigms.

If a truly full repo review is still desired, which depth is preferred: (1) correctness/bugs, (2) security/threat modeling, or (3) API design and maintainability?

---

# Follow-up from Perplexity review

We want chat to store the Perplexity chat **URL** (not a generated GUID). We also want to remove `as any` casts and enable streaming; focus on points 1 (correctness/bugs) and 3 (API design & maintainability).

Below are the deeper review findings and architectural recommendations extracted from the earlier review:

### 1. Critical Architecture Fix: Chat Identity (UUID vs. URL)

**The Issue:**
Currently, `chatPerplexity.ts` and `toolHandlerSetup.ts` generate a random UUID (`crypto.randomUUID()`) for new chats. This doesn't correspond to an actual Perplexity chat URL and cannot be used to resume conversations.

**The Fix:**
Do not generate IDs client-side. Treat the **URL** as the primary key. Key actions:

1. Update `SearchEngine.performSearch` to return the final page URL along with the answer.
2. Update `chatPerplexity` to remove UUID creation and instead rely on the returned URL for `chat_id`.
3. Ensure DB stores `chat_id` as a URL (TEXT) and return the URL to clients for resumption.


### 2. Type Safety & `as any` Casts

**The Issue:**
The codebase contains `as any` casts (e.g., `PerplexityServer.ts`), which defeat TypeScript guarantees and mask real issues.

**The Fix:**
Remove casts and align interfaces. `IBrowserManager` should declare methods used by the server (e.g., `getPuppeteerContext()`). Update usages to the typed interface.


### 3. Streaming Implementation is Broken

**The Issue:**
`src/tools/search.ts` returns `AsyncGenerator` when `stream: true`, but the server does not iterate it; it simply awaits the result and returns it (broken streaming). MCP does not natively support streaming, so this must be implemented with notifications or accumulated and returned.

**The Fix:**
Detect `AsyncGenerator` results in `toolHandlerSetup.ts`. Iterate and optionally emit progress notifications, then return the accumulated string for standard MCP clients.


### 4. Database & Runtime Constraints

**The Issue:**
`DatabaseManager.ts` imports `Database` from `bun:sqlite`, locking the runtime to Bun.

**The Fix:**
Use a Node-compatible SQLite driver like `better-sqlite3`, or add an adapter layer to support both Bun and Node.


## Step-by-Step Implementation Plan (from reviewer)

### Phase 1: Fix Type Safety & Runtime Hygiene

1. Remove `as any` cast in `src/server/PerplexityServer.ts`.
2. Fix `login.ts` to avoid `(window as any).chrome` and use typed declarations.

### Phase 2: Implement Real Streaming (MCP Compatible)

3. Update `src/server/toolHandlerSetup.ts` to detect `AsyncGenerator` results and iterate them; optionally issue progress notifications instead of returning the generator object.

### Phase 3: Fix Chat Identity (URL as ID)

4. Change `SearchEngine.performSearch` to return `{ answer, url, citations }`.
5. Update `chatPerplexity.ts` to rely on returned URL as canonical `chat_id` and remove client-side UUID generation.

### Phase 4: Implement RAG Archival (Local RAG)

6. Add `src/server/modules/RagArchiver.ts` with `log(doc)` appending to `data/rag_archive.jsonl`.
7. Inject `RagArchiver` into `DatabaseManager` and call from `saveChatMessage`.

### Phase 5: Runtime Cleanup

8. Replace `bun:sqlite` with `better-sqlite3` or add an adapter for Node/Bun interoperability.

### Phase 6: Code Review & Commit

9. Run build/tests and manual integration tests; verify `rag_archive.jsonl` entries and `chat_id` URLs.

---

If you want, I can implement the high-priority code changes (remove `as any`, switch chat_id to URLs, add `RagArchiver.log`, and update the streaming handler) as a focused PR — tell me which subset you want first (I recommend starting with chat identity + RAG archiver).
