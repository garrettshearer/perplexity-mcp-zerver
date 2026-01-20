import { promises as fs } from "node:fs";
import type { Browser, Page } from "puppeteer";
/**
 * Puppeteer utility functions for browser automation, navigation, and recovery
 */
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { CONFIG } from "../server/config.js";
import type { PuppeteerContext, RecoveryContext } from "../types/index.js";
import { logError, logInfo, logWarn } from "./logging.js";
import {
  analyzeError,
  calculateRetryDelay,
  determineRecoveryLevel,
  generateBrowserArgs,
  getCaptchaSelectors,
  getSearchInputSelectors,
} from "./puppeteer-logic.js";

// Apply stealth plugin to reduce bot detection
puppeteer.use(StealthPlugin());

export async function initializeBrowser(ctx: PuppeteerContext) {
  if (ctx.isInitializing) {
    logInfo("Browser initialization already in progress...");
    return;
  }
  ctx.setIsInitializing(true);
  try {
    if (ctx.browser) {
      await ctx.browser.close();
    }
    const headless = CONFIG.HEADLESS;
    let browserArgs = generateBrowserArgs(CONFIG.USER_AGENT);

    // Remove GPU-disabling flags when in non-headless mode (needed for rendering)
    if (headless === false) {
      browserArgs = browserArgs.filter(
        (arg) => !arg.includes("--disable-gpu") && !arg.includes("--disable-accelerated-2d-canvas"),
      );
    }

    const browser = await puppeteer.launch({
      headless: headless as boolean | "shell" | undefined,
      args: browserArgs,
      userDataDir: CONFIG.USE_PERSISTENT_PROFILE ? CONFIG.BROWSER_DATA_DIR : undefined,
    });
    ctx.setBrowser(browser);
    const page = await browser.newPage();
    ctx.setPage(page);
    await setupBrowserEvasion(ctx);
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });
    await page.setUserAgent(CONFIG.USER_AGENT);
    page.setDefaultNavigationTimeout(CONFIG.PAGE_TIMEOUT);

    if (CONFIG.USE_PERSISTENT_PROFILE) {
      logInfo(`Browser initialized with persistent profile at: ${CONFIG.BROWSER_DATA_DIR}`);
    } else {
      logInfo("Browser initialized (anonymous mode)");
    }
    // NOTE: Navigation to Perplexity is intentionally deferred (lazy initialization).
    // Each tool handles navigation when invoked, reducing startup time and avoiding
    // unnecessary browser operations if no tools are called.
  } catch (error) {
    logError(`Browser initialization failed: ${error}`);
    if (ctx.browser) {
      // Clean up on failure
      try {
        await ctx.browser.close();
      } catch (closeError) {
        logError(`Failed to close browser after initialization error: ${closeError}`);
      }
      ctx.setBrowser(null);
    }
    ctx.setPage(null);
    throw new Error(
      `Page not initialized: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    ctx.setIsInitializing(false);
  }
}

// Helper functions for navigation
async function performInitialNavigation(page: Page): Promise<void> {
  try {
    await page.goto("https://www.perplexity.ai/", {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.PAGE_TIMEOUT,
    });
    const isInternalError = await page.evaluate(() => {
      return document.querySelector("main")?.textContent?.includes("internal error") ?? false;
    });
    if (isInternalError) {
      throw new Error("Perplexity.ai returned internal error page");
    }
  } catch (gotoError) {
    if (
      gotoError instanceof Error &&
      !gotoError.message.toLowerCase().includes("timeout") &&
      !gotoError.message.includes("internal error")
    ) {
      logError(`Initial navigation request failed: ${gotoError}`);
      throw gotoError;
    }
    logWarn(
      `Navigation issue detected: ${gotoError instanceof Error ? gotoError.message : String(gotoError)}`,
    );
  }
}

async function validatePageState(page: Page): Promise<void> {
  if (page.isClosed() ?? page.mainFrame().isDetached()) {
    logError("Page closed or frame detached immediately after navigation attempt.");
    throw new Error("Frame detached during navigation");
  }
}

async function waitForAndValidateSearchInput(ctx: PuppeteerContext): Promise<void> {
  const { page } = ctx;
  if (!page) throw new Error("Page not initialized");

  const searchInput = await waitForSearchInput(ctx);
  if (!searchInput) {
    logError("Search input not found after navigation");
    throw new Error(
      "Search input not found after navigation - page might not have loaded correctly",
    );
  }
}

async function validateFinalPageState(page: Page): Promise<void> {
  // Optimized: Skip the 3-second wait and just validate URL quickly
  let pageUrl = "N/A";

  try {
    if (!page.isClosed()) {
      pageUrl = page.url();
    }
  } catch (titleError) {
    // Skip logging minor errors
  }

  if (pageUrl !== "N/A" && !pageUrl.includes("perplexity.ai")) {
    logError(`Unexpected URL: ${pageUrl}`);
    throw new Error(`Navigation redirected to unexpected URL: ${pageUrl}`);
  }
}

async function handleNavigationFailure(page: Page, error: unknown): Promise<never> {
  logError(`Navigation failed: ${error}`);

  // Only capture screenshot for actual failures, not recoverable issues
  const shouldCaptureScreenshot = CONFIG.DEBUG.CAPTURE_SCREENSHOTS && !isRecoverableError(error);

  if (shouldCaptureScreenshot) {
    try {
      if (page && !page.isClosed()) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        // Explicitly type the path with the correct extension to satisfy TypeScript
        const screenshotPath = `debug_navigation_failed_${timestamp}.png` as const;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logInfo(`Captured screenshot of failed navigation state: ${screenshotPath}`);
      }
    } catch (screenshotError) {
      logError(`Failed to capture screenshot: ${screenshotError}`);
    }
  }

  throw error;
}

function isRecoverableError(error: unknown): boolean {
  if (!error) return false;

  const errorMsg =
    typeof error === "string"
      ? error
      : (error instanceof Error ? error.message : String(error)).toLowerCase();

  // These are errors that our recovery system can handle
  return (
    errorMsg.includes("search input not found") ||
    errorMsg.includes("captcha") ||
    errorMsg.includes("timeout") ||
    errorMsg.includes("navigation")
  );
}

export async function navigateToPerplexity(ctx: PuppeteerContext) {
  const { page } = ctx;
  if (!page) throw new Error("Page not initialized");

  try {
    logInfo("Navigating to Perplexity.ai...");

    await performInitialNavigation(page);
    await validatePageState(page);
    await waitForAndValidateSearchInput(ctx);
    await validateFinalPageState(page);

    logInfo("Navigation and readiness check completed successfully");
  } catch (error) {
    await handleNavigationFailure(page, error);
  }
}

/**
 * Navigate to an existing Perplexity chat by ID.
 * The chat history is automatically loaded from the URL - no message replay needed.
 *
 * @param ctx - The Puppeteer context with initialized page
 * @param chatId - The chat ID to navigate to
 * @throws Error if page not initialized, chat not found (404), auth required, or textarea not found
 */
export async function openPerplexityChat(ctx: PuppeteerContext, chatId: string): Promise<void> {
  const { page } = ctx;

  // Validate page is initialized
  if (!page || page.isClosed()) {
    throw new Error("Page not initialized");
  }

  const chatUrl = `https://www.perplexity.ai/search/${chatId}`;
  ctx.log("info", `Navigating to existing chat: ${chatUrl}`);

  // Navigate with 30 second timeout (FR-009)
  const response = await page.goto(chatUrl, {
    waitUntil: "domcontentloaded",
    timeout: CONFIG.TIMEOUT_PROFILES.navigation,
  });

  // Check HTTP response status
  if (response) {
    const status = response.status();
    if (status === 404) {
      throw new Error("Chat not found: The specified chat ID does not exist or has been deleted");
    }
    if (!response.ok()) {
      throw new Error(`Failed to load chat: HTTP ${status}`);
    }
  }

  // Verify we're still on Perplexity (detect auth redirects)
  const currentUrl = page.url();
  if (!currentUrl.includes("perplexity.ai")) {
    throw new Error("Authentication required: Redirected away from Perplexity");
  }

  // Wait for textarea with 10 second timeout (FR-010)
  const selectors = getSearchInputSelectors();
  const selectorStr = selectors.join(", ");

  try {
    await page.waitForSelector(selectorStr, {
      timeout: CONFIG.SELECTOR_TIMEOUT,
      visible: true,
    });
  } catch {
    throw new Error(
      "Chat page loaded but input area not found: The page may not have loaded correctly",
    );
  }

  ctx.log("info", `Successfully opened chat: ${chatId}`);
}

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
export async function openPerplexitySpace(ctx: PuppeteerContext, spaceId: string): Promise<void> {
  const { page } = ctx;

  // T022: Validate page is initialized
  if (!page || page.isClosed()) {
    throw new Error("Page not initialized");
  }

  // T023: Validate space ID is not empty or whitespace
  if (!spaceId || spaceId.trim() === "") {
    throw new Error("Space ID is required: Please provide a valid space ID");
  }

  const spaceUrl = `https://www.perplexity.ai/spaces/${spaceId}`;
  ctx.log("info", `Navigating to space: ${spaceUrl}`);

  // T024, T025: Navigate with 30 second timeout
  const response = await page.goto(spaceUrl, {
    waitUntil: "domcontentloaded",
    timeout: CONFIG.TIMEOUT_PROFILES.navigation,
  });

  // T025: Check HTTP response status - 404 means space not found
  if (response) {
    const status = response.status();
    if (status === 404) {
      throw new Error(
        `Space not found: The space '${spaceId}' does not exist or has been deleted. Please verify the space ID is correct.`,
      );
    }
    if (!response.ok()) {
      throw new Error(`Failed to load space: HTTP ${status}`);
    }
  }

  // T026: Verify we're still on Perplexity (detect auth redirects)
  const currentUrl = page.url();
  if (!currentUrl.includes("perplexity.ai")) {
    throw new Error(
      "Authentication required: Redirected away from Perplexity. Please check that you are logged in.",
    );
  }

  // T027: Wait for textarea with 10 second timeout
  const selectors = getSearchInputSelectors();
  const selectorStr = selectors.join(", ");

  try {
    await page.waitForSelector(selectorStr, {
      timeout: CONFIG.SELECTOR_TIMEOUT,
      visible: true,
    });
  } catch {
    throw new Error(
      "Space page loaded but input area not found: The page may not have loaded correctly. Try refreshing or check if the space is accessible.",
    );
  }

  // T028: Log success
  ctx.log("info", `Successfully opened space: ${spaceId}`);
}

/**
 * Switch to a specific AI model in the Perplexity UI.
 *
 * Opens the model selector dropdown, finds the requested model (case-insensitive),
 * and selects it. Supports partial matching (e.g., "Claude" matches "Claude 3.5 Sonnet").
 *
 * @param ctx - The Puppeteer context with initialized page
 * @param requestedModel - The model name to switch to (case-insensitive, partial match supported)
 * @returns ModelSwitchResult with success status and details
 * @throws Error if:
 *   - Page not initialized
 *   - Dropdown cannot be opened (likely not logged in)
 *   - Model options don't load within timeout (5s)
 *   - Requested model not found in dropdown
 */
export async function switchModel(
  ctx: PuppeteerContext,
  requestedModel: string,
): Promise<import("../types/index.js").ModelSwitchResult> {
  const { page } = ctx;

  // Validate page is initialized
  if (!page || page.isClosed()) {
    throw new Error("Page not initialized");
  }

  ctx.log("info", `Attempting to switch model to: ${requestedModel}`);

  // Import helper functions from puppeteer-logic
  const { MODEL_SELECTORS, normalizeModelName, matchesModelName } = await import(
    "./puppeteer-logic.js"
  );

  // Step 1: Check if model is already selected (optimization for US3)
  const currentSelection = await getCurrentModelSelection(page, MODEL_SELECTORS);
  if (currentSelection && matchesModelName(currentSelection, requestedModel)) {
    ctx.log("info", `Model "${requestedModel}" is already selected`);
    return {
      success: true,
      selectedModel: currentSelection,
      wasAlreadySelected: true,
    };
  }

  // Step 2: Find and click the dropdown trigger
  const dropdownOpened = await openModelDropdown(page, MODEL_SELECTORS, ctx);
  if (!dropdownOpened) {
    throw new Error(
      "Could not open model selector dropdown. Please ensure you are logged in and on a page with the model selector.",
    );
  }

  // Step 3: Wait for options to appear (5s timeout per FR-004)
  const options = await waitForModelOptions(page, MODEL_SELECTORS, 5000);
  if (!options || options.length === 0) {
    throw new Error("Model selector options did not load within 5000ms.");
  }

  // Step 4: Find matching model option (case-insensitive)
  const availableModels = options.map((opt) => opt.text);
  const matchingOption = options.find((opt) => matchesModelName(opt.text, requestedModel));

  if (!matchingOption) {
    // Close dropdown before throwing error
    await page.keyboard.press("Escape").catch(() => {});
    throw new Error(
      `Model "${requestedModel}" not found in dropdown options. Available models: ${availableModels.join(", ")}`,
    );
  }

  // Step 5: Click the matching option
  try {
    await matchingOption.element.click();
    ctx.log("info", `Successfully selected model: ${matchingOption.text}`);

    // Small delay to let UI update
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      selectedModel: matchingOption.text,
      wasAlreadySelected: false,
    };
  } catch (clickError) {
    throw new Error(
      `Failed to click model option "${matchingOption.text}": ${clickError instanceof Error ? clickError.message : String(clickError)}`,
    );
  }
}

/**
 * Get the currently selected model from the dropdown trigger
 */
async function getCurrentModelSelection(
  page: import("puppeteer").Page,
  selectors: typeof import("./puppeteer-logic.js").MODEL_SELECTORS,
): Promise<string | null> {
  try {
    // Try each dropdown trigger selector
    for (const selector of selectors.dropdownTrigger) {
      const element = await page.$(selector);
      if (element) {
        const text = await page.evaluate((el) => el.textContent?.trim() || "", element);
        if (text && text.length > 0) {
          return text;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Open the model selector dropdown
 */
async function openModelDropdown(
  page: import("puppeteer").Page,
  selectors: typeof import("./puppeteer-logic.js").MODEL_SELECTORS,
  ctx: PuppeteerContext,
): Promise<boolean> {
  // Try each dropdown trigger selector
  for (const selector of selectors.dropdownTrigger) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        // Wait a bit for dropdown to open
        await new Promise((resolve) => setTimeout(resolve, 200));
        ctx.log("info", `Clicked dropdown trigger using selector: ${selector}`);
        return true;
      }
    } catch {
      // Continue to next selector
    }
  }
  return false;
}

/**
 * Wait for model options to appear and return them
 */
async function waitForModelOptions(
  page: import("puppeteer").Page,
  selectors: typeof import("./puppeteer-logic.js").MODEL_SELECTORS,
  timeout: number,
): Promise<Array<{ text: string; element: import("puppeteer").ElementHandle }> | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Try to find options container first
    for (const containerSelector of selectors.optionsContainer) {
      const container = await page.$(containerSelector);
      if (container) {
        // Look for option items within container or globally
        for (const optionSelector of selectors.optionItem) {
          const options = await page.$$(optionSelector);
          if (options.length > 0) {
            // Extract text from each option
            const optionsWithText = await Promise.all(
              options.map(async (el) => ({
                text: await page.evaluate((e) => e.textContent?.trim() || "", el),
                element: el,
              })),
            );
            // Filter out empty options
            const validOptions = optionsWithText.filter((opt) => opt.text.length > 0);
            if (validOptions.length > 0) {
              return validOptions;
            }
          }
        }
      }
    }

    // Also try option selectors directly (without container)
    for (const optionSelector of selectors.optionItem) {
      const options = await page.$$(optionSelector);
      if (options.length > 1) {
        // More than 1 to ensure it's the dropdown, not current selection
        const optionsWithText = await Promise.all(
          options.map(async (el) => ({
            text: await page.evaluate((e) => e.textContent?.trim() || "", el),
            element: el,
          })),
        );
        const validOptions = optionsWithText.filter((opt) => opt.text.length > 0);
        if (validOptions.length > 1) {
          return validOptions;
        }
      }
    }

    // Wait a bit before next check
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export async function setupBrowserEvasion(ctx: PuppeteerContext) {
  const { page } = ctx;
  if (!page) return;
  await page.evaluateOnNewDocument(() => {
    Object.defineProperties(navigator, {
      webdriver: { get: () => undefined },
      hardwareConcurrency: { get: () => 8 },
      deviceMemory: { get: () => 8 },
      platform: { get: () => "Win32" },
      languages: { get: () => ["en-US", "en"] },
      permissions: {
        get: () => ({
          query: async () => ({ state: "prompt" }),
        }),
      },
    });
    if (typeof window.chrome === "undefined") {
      window.chrome = {
        app: {
          InstallState: {
            DISABLED: "disabled",
            INSTALLED: "installed",
            NOT_INSTALLED: "not_installed",
          },
          RunningState: {
            CANNOT_RUN: "cannot_run",
            READY_TO_RUN: "ready_to_run",
            RUNNING: "running",
          },
          getDetails: () => {},
          getIsInstalled: () => {},
          installState: () => {},
          isInstalled: false,
          runningState: () => {},
        },
        runtime: {
          OnInstalledReason: {
            CHROME_UPDATE: "chrome_update",
            INSTALL: "install",
            SHARED_MODULE_UPDATE: "shared_module_update",
            UPDATE: "update",
          },
          PlatformArch: {
            ARM: "arm",
            ARM64: "arm64",
            MIPS: "mips",
            MIPS64: "mips64",
            X86_32: "x86-32",
            X86_64: "x86-64",
          },
          PlatformNaclArch: {
            ARM: "arm",
            MIPS: "mips",
            PNACL: "pnacl",
            X86_32: "x86-32",
            X86_64: "x86-64",
          },
          PlatformOs: {
            ANDROID: "android",
            CROS: "cros",
            LINUX: "linux",
            MAC: "mac",
            OPENBSD: "openbsd",
            WIN: "win",
          },
          RequestUpdateCheckStatus: {
            NO_UPDATE: "no_update",
            THROTTLED: "throttled",
            UPDATE_AVAILABLE: "update_available",
          },
          connect: () => ({
            postMessage: () => {},
            onMessage: {
              addListener: () => {},
              removeListener: () => {},
            },
            disconnect: () => {},
          }),
        },
      };
    }
  });
}

export async function waitForSearchInput(
  ctx: PuppeteerContext,
  timeout = CONFIG.SELECTOR_TIMEOUT,
): Promise<string | null> {
  const { page, setSearchInputSelector } = ctx;
  if (!page) return null;

  // Optimized: Try the most common selector first with shorter timeout
  const primarySelector = '[role="textbox"]';
  try {
    const element = await page.waitForSelector(primarySelector, {
      timeout: 2000,
      visible: true,
    });
    if (element) {
      const isInteractive = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true";
      }, primarySelector);
      if (isInteractive) {
        setSearchInputSelector(primarySelector);
        return primarySelector;
      }
    }
  } catch {
    // Fall back to other selectors only if primary fails
  }

  const fallbackSelectors = getSearchInputSelectors().filter((s) => s !== primarySelector);
  for (const selector of fallbackSelectors) {
    try {
      const element = await page.waitForSelector(selector, {
        timeout: 1500, // Reduced timeout for fallbacks
        visible: true,
      });
      if (element) {
        const isInteractive = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true";
        }, selector);
        if (isInteractive) {
          setSearchInputSelector(selector);
          return selector;
        }
      }
    } catch {
      // Continue to next selector without logging
    }
  }

  logError("No working search input found");
  return null;
}

export async function checkForCaptcha(ctx: PuppeteerContext): Promise<boolean> {
  const { page } = ctx;
  if (!page) return false;
  const captchaIndicators = getCaptchaSelectors();
  return await page.evaluate((selectors) => {
    return selectors.some((selector) => !!document.querySelector(selector));
  }, captchaIndicators);
}

// Helper functions for recovery procedure
async function performPageRefresh(ctx: PuppeteerContext): Promise<void> {
  logInfo("Attempting page refresh (Recovery Level 1)");
  if (ctx.page && !ctx.page?.isClosed()) {
    try {
      await ctx.page.reload({ timeout: CONFIG.TIMEOUT_PROFILES.navigation });
    } catch (reloadError) {
      logWarn(
        `Page reload failed: ${reloadError instanceof Error ? reloadError.message : String(reloadError)}. Proceeding with recovery.`,
      );
    }
  } else {
    logWarn("Page was null or closed, cannot refresh. Proceeding with recovery.");
  }
}

async function performNewPageCreation(ctx: PuppeteerContext): Promise<number> {
  logInfo("Creating new page instance (Recovery Level 2)");

  if (ctx.page) {
    try {
      if (!ctx.page?.isClosed()) await ctx.page.close();
    } catch (closeError) {
      logWarn(
        `Ignoring error closing old page: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
      );
    }
    ctx.setPage(null);
  }

  if (!ctx.browser?.isConnected()) {
    logWarn(
      "Browser was null or disconnected, cannot create new page. Escalating to full restart.",
    );
    return 3; // Escalate to full restart
  }

  try {
    const page = await ctx.browser.newPage();
    ctx.setPage(page);
    await setupBrowserEvasion(ctx);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(CONFIG.USER_AGENT);
    return 2; // Success
  } catch (newPageError) {
    logError(
      `Failed to create new page: ${newPageError instanceof Error ? newPageError.message : String(newPageError)}. Escalating to full restart.`,
    );
    return 3; // Escalate to full restart
  }
}

// Helper functions for browser restart
async function cleanupPage(ctx: PuppeteerContext): Promise<void> {
  if (!ctx.page) return;

  try {
    if (!ctx.page.isClosed()) await ctx.page.close();
  } catch (closeError) {
    logWarn(
      `Ignoring error closing page during full restart: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
    );
  }
}

async function cleanupBrowser(ctx: PuppeteerContext): Promise<void> {
  if (!ctx.browser) return;

  try {
    if (ctx.browser.isConnected()) await ctx.browser.close();
  } catch (closeError) {
    logWarn(
      `Ignoring error closing browser during full restart: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
    );
  }
}

async function performFullBrowserRestart(ctx: PuppeteerContext): Promise<void> {
  logInfo("Performing full browser restart (Recovery Level 3)");

  await cleanupPage(ctx);
  await cleanupBrowser(ctx);

  ctx.setPage(null);
  ctx.setBrowser(null);
  ctx.setIsInitializing(false); // Ensure flag is reset

  logInfo("Waiting before re-initializing browser...");
  await new Promise((resolve) => setTimeout(resolve, CONFIG.RECOVERY_WAIT_TIME));
  await initializeBrowser(ctx); // This will set page and browser again
}

export async function recoveryProcedure(ctx: PuppeteerContext, error?: Error): Promise<void> {
  // Create recovery context for analysis
  const recoveryContext: RecoveryContext = {
    hasValidPage: !!(ctx.page && !ctx.page.isClosed() && !ctx.page.mainFrame()?.isDetached()),
    hasBrowser: !!ctx.browser,
    isBrowserConnected: !!ctx.browser?.isConnected(),
    operationCount: ctx.operationCount,
  };

  const recoveryLevel = determineRecoveryLevel(error, recoveryContext);
  const opId = ctx.incrementOperationCount();

  logInfo("Starting recovery procedure");

  // Clean up old debug screenshots periodically
  if (opId % 5 === 0) {
    cleanupOldDebugScreenshots().catch((err) =>
      logWarn(`Failed to cleanup old screenshots: ${err}`),
    );
  }

  try {
    switch (recoveryLevel) {
      case 1: // Page refresh
        logInfo("Attempting page refresh (Recovery Level 1)");
        if (ctx.page && !ctx.page?.isClosed()) {
          try {
            await ctx.page.reload({ timeout: CONFIG.TIMEOUT_PROFILES.navigation });
          } catch (reloadError) {
            logWarn(
              `Page reload failed: ${reloadError instanceof Error ? reloadError.message : String(reloadError)}. Proceeding with recovery.`,
            );
          }
        } else {
          logWarn("Page was null or closed, cannot refresh. Proceeding with recovery.");
        }
        break;

      case 2: // New page (Currently unused due to level escalation, kept for potential future use)
        logInfo("Creating new page instance (Recovery Level 2)");
        if (ctx.page) {
          try {
            if (!ctx.page?.isClosed()) await ctx.page.close();
          } catch (closeError) {
            logWarn(
              `Ignoring error closing old page: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
            );
          }
          ctx.setPage(null);
        }
        if (ctx.browser?.isConnected()) {
          try {
            const page = await ctx.browser.newPage();
            ctx.setPage(page);
            await setupBrowserEvasion(ctx);
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent(CONFIG.USER_AGENT);
          } catch (newPageError) {
            logError(
              `Failed to create new page: ${newPageError instanceof Error ? newPageError.message : String(newPageError)}. Escalating to full restart.`,
            );
            // Force level 3 if creating a new page fails
            return await recoveryProcedure(ctx, new Error("Fallback recovery: new page failed"));
          }
        } else {
          logWarn(
            "Browser was null or disconnected, cannot create new page. Escalating to full restart.",
          );
          return await recoveryProcedure(ctx, new Error("Fallback recovery: browser disconnected"));
        }
        break;
      default:
        logInfo("Performing full browser restart (Recovery Level 3)");
        if (ctx.page) {
          try {
            if (!ctx.page.isClosed()) await ctx.page.close();
          } catch (closeError) {
            logWarn(
              `Ignoring error closing page during full restart: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
            );
          }
        }
        if (ctx.browser) {
          try {
            if (ctx.browser.isConnected()) await ctx.browser.close();
          } catch (closeError) {
            logWarn(
              `Ignoring error closing browser during full restart: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
            );
          }
        }
        ctx.setPage(null);
        ctx.setBrowser(null);
        ctx.setIsInitializing(false); // Ensure flag is reset
        logInfo("Waiting before re-initializing browser...");
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RECOVERY_WAIT_TIME));
        await initializeBrowser(ctx); // This will set page and browser again
        break;
    }

    logInfo("Recovery completed");
  } catch (recoveryError) {
    logError(
      `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
    );

    // Fall back to more aggressive recovery if initial attempt fails
    if (recoveryLevel < 3) {
      logInfo("Attempting higher level recovery");
      await recoveryProcedure(ctx, new Error("Fallback recovery"));
    } else {
      throw recoveryError;
    }
  }
}

// Helper functions for retry operation
/**
 * Generate critical error recovery delay with jitter
 * Note: Math.random() is safe here - only used for timing distribution, not security
 */
function generateCriticalErrorDelay(): number {
  return 10000 + Math.random() * 5000; // 10-15 seconds
}

async function handleDetachedFrameError(ctx: PuppeteerContext, error: Error): Promise<void> {
  const errorMsg = error.message;
  logError(
    `Detached frame or protocol error detected ('${errorMsg.substring(0, 100)}...'). Initiating immediate recovery.`,
  );
  await recoveryProcedure(ctx, error);
  const criticalWaitTime = generateCriticalErrorDelay();
  logInfo(
    `Waiting ${Math.round(criticalWaitTime / 1000)} seconds after critical error recovery...`,
  );
  await new Promise((resolve) => setTimeout(resolve, criticalWaitTime));
}

async function handleCaptchaDetection(ctx: PuppeteerContext): Promise<boolean> {
  if (!ctx.page || ctx.page?.isClosed() || ctx.page.mainFrame().isDetached()) {
    logWarn("Skipping CAPTCHA check as page is invalid.");
    return false;
  }

  try {
    const captchaDetected = await checkForCaptcha(ctx);
    if (captchaDetected) {
      logError("CAPTCHA detected! Initiating recovery...");
      await recoveryProcedure(ctx);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait after CAPTCHA recovery
      return true;
    }
  } catch (captchaCheckError) {
    logWarn(`Error checking for CAPTCHA: ${captchaCheckError}`);
  }

  return false;
}

async function handleTimeoutError(
  ctx: PuppeteerContext,
  consecutiveTimeouts: number,
): Promise<void> {
  logError(
    `Timeout detected during operation (${consecutiveTimeouts} consecutive), attempting recovery...`,
  );
  await recoveryProcedure(ctx);
  const timeoutWaitTime = Math.min(5000 * consecutiveTimeouts, 30000);
  logInfo(`Waiting ${timeoutWaitTime / 1000} seconds after timeout...`);
  await new Promise((resolve) => setTimeout(resolve, timeoutWaitTime));
}

async function handleNavigationError(
  ctx: PuppeteerContext,
  consecutiveNavigationErrors: number,
): Promise<void> {
  logError(
    `Navigation error detected (${consecutiveNavigationErrors} consecutive), attempting recovery...`,
  );
  await recoveryProcedure(ctx);
  const navWaitTime = Math.min(8000 * consecutiveNavigationErrors, 40000);
  logInfo(`Waiting ${navWaitTime / 1000} seconds after navigation error...`);
  await new Promise((resolve) => setTimeout(resolve, navWaitTime));
}

/**
 * Generate connection error recovery delay with jitter
 * Note: Math.random() is safe here - only used for timing distribution, not security
 */
function generateConnectionErrorDelay(): number {
  return 15000 + Math.random() * 10000; // 15-25 seconds
}

async function handleConnectionError(ctx: PuppeteerContext): Promise<void> {
  logError("Connection or protocol error detected, attempting recovery with longer wait...");
  await recoveryProcedure(ctx);
  const connectionWaitTime = generateConnectionErrorDelay();
  logInfo(`Waiting ${Math.round(connectionWaitTime / 1000)} seconds after connection error...`);
  await new Promise((resolve) => setTimeout(resolve, connectionWaitTime));
}

/**
 * Generate navigation failure delay with jitter
 * Note: Math.random() is safe here - only used for timing distribution, not security
 */
function generateNavigationFailureDelay(): number {
  return 10000 + Math.random() * 5000; // 10-15 seconds
}

async function handleRetryNavigation(ctx: PuppeteerContext, attemptNumber: number): Promise<void> {
  try {
    logInfo("Attempting to re-navigate to Perplexity...");
    await navigateToPerplexity(ctx);
    logInfo("Re-navigation successful");
  } catch (navError) {
    logError(`Navigation failed during retry: ${navError}`);
    const navFailWaitTime = generateNavigationFailureDelay();
    logInfo(
      `Navigation failed, waiting ${Math.round(navFailWaitTime / 1000)} seconds before next attempt...`,
    );
    await new Promise((resolve) => setTimeout(resolve, navFailWaitTime));
    if (attemptNumber > 1) {
      logInfo("Multiple navigation failures, attempting full recovery...");
      await recoveryProcedure(ctx);
    }
  }
}

// Additional helper for retry operation
async function handleRetryError(
  ctx: PuppeteerContext,
  error: Error,
  attemptNumber: number,
  consecutiveTimeouts: number,
  consecutiveNavigationErrors: number,
): Promise<{
  shouldContinue: boolean;
  newConsecutiveTimeouts: number;
  newConsecutiveNavigationErrors: number;
}> {
  const errorAnalysis = analyzeError(error);
  errorAnalysis.consecutiveTimeouts = consecutiveTimeouts;
  errorAnalysis.consecutiveNavigationErrors = consecutiveNavigationErrors;

  // Handle detached frame errors immediately
  if (errorAnalysis.isDetachedFrame) {
    await handleDetachedFrameError(ctx, error);
    return {
      shouldContinue: true,
      newConsecutiveTimeouts: consecutiveTimeouts,
      newConsecutiveNavigationErrors: consecutiveNavigationErrors,
    };
  }

  // Check for CAPTCHA
  const captchaHandled = await handleCaptchaDetection(ctx);
  if (captchaHandled) {
    return {
      shouldContinue: true,
      newConsecutiveTimeouts: consecutiveTimeouts,
      newConsecutiveNavigationErrors: consecutiveNavigationErrors,
    };
  }

  // Handle specific error types
  if (errorAnalysis.isTimeout) {
    await handleTimeoutError(ctx, consecutiveTimeouts + 1);
    return {
      shouldContinue: true,
      newConsecutiveTimeouts: consecutiveTimeouts + 1,
      newConsecutiveNavigationErrors: consecutiveNavigationErrors,
    };
  }

  if (errorAnalysis.isNavigation) {
    await handleNavigationError(ctx, consecutiveNavigationErrors + 1);
    return {
      shouldContinue: true,
      newConsecutiveTimeouts: consecutiveTimeouts,
      newConsecutiveNavigationErrors: consecutiveNavigationErrors + 1,
    };
  }

  if (errorAnalysis.isConnection) {
    await handleConnectionError(ctx);
    return {
      shouldContinue: true,
      newConsecutiveTimeouts: consecutiveTimeouts,
      newConsecutiveNavigationErrors: consecutiveNavigationErrors,
    };
  }

  // Handle general retry logic with navigation
  const delay = calculateRetryDelay(attemptNumber, errorAnalysis);
  logInfo(`Retrying in ${Math.round(delay / 1000)} seconds...`);
  await new Promise((resolve) => setTimeout(resolve, delay));
  await handleRetryNavigation(ctx, attemptNumber);

  return {
    shouldContinue: true,
    newConsecutiveTimeouts: consecutiveTimeouts,
    newConsecutiveNavigationErrors: consecutiveNavigationErrors,
  };
}

export async function retryOperation<T>(
  ctx: PuppeteerContext,
  operation: () => Promise<T>,
  maxRetries = CONFIG.MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;
  let consecutiveTimeouts = 0;
  let consecutiveNavigationErrors = 0;
  let hadRecovery = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      logInfo(`Attempt ${i + 1}/${maxRetries}...`);
      const result = await operation();

      // If we had recovery attempts and now succeeded, track the success
      if (hadRecovery && i > 0) {
        logInfo("Operation succeeded after recovery - cleaning up debug artifacts");
        trackRecoverySuccess(ctx);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logError(`Attempt ${i + 1} failed: ${error}`);

      if (i === maxRetries - 1) {
        logError(`Maximum retry attempts (${maxRetries}) reached. Giving up.`);
        break;
      }

      hadRecovery = true;
      const retryResult = await handleRetryError(
        ctx,
        lastError,
        i,
        consecutiveTimeouts,
        consecutiveNavigationErrors,
      );
      consecutiveTimeouts = retryResult.newConsecutiveTimeouts;
      consecutiveNavigationErrors = retryResult.newConsecutiveNavigationErrors;
    }
  }

  const errorMessage = lastError
    ? `Operation failed after ${maxRetries} retries. Last error: ${lastError.message}`
    : `Operation failed after ${maxRetries} retries with unknown error`;
  logError(errorMessage);
  throw new Error(errorMessage);
}

/**
 * Clean up old debug screenshots to prevent disk space issues
 */
async function cleanupOldDebugScreenshots(): Promise<void> {
  try {
    const files = await fs.readdir(".");
    const debugFiles = files.filter((file) => file.startsWith("debug_navigation_failed_"));

    const maxScreenshots = CONFIG.DEBUG.MAX_SCREENSHOTS;
    if (debugFiles.length <= maxScreenshots) return;

    // Sort by creation time (newest first) and remove older ones
    const fileStats = await Promise.all(
      debugFiles.map(async (file) => ({
        name: file,
        mtime: (await fs.stat(file)).mtime,
      })),
    );

    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    const filesToDelete = fileStats.slice(maxScreenshots);

    for (const file of filesToDelete) {
      try {
        await fs.unlink(file.name);
        logInfo(`Cleaned up old debug screenshot: ${file.name}`);
      } catch (deleteError) {
        logWarn(`Failed to delete old screenshot ${file.name}: ${deleteError}`);
      }
    }
  } catch (error) {
    logWarn(`Error during screenshot cleanup: ${error}`);
  }
}

/**
 * Track recovery success and clean up screenshots when recovery works
 */
function trackRecoverySuccess(ctx: PuppeteerContext): void {
  // If we successfully complete an operation after recovery,
  // we can clean up any recent debug screenshots since the issue was resolved
  cleanupOldDebugScreenshots().catch((err) =>
    logWarn(`Failed to cleanup screenshots after successful recovery: ${err}`),
  );
}

export function resetIdleTimeout(ctx: PuppeteerContext) {
  if (ctx.idleTimeout) {
    clearTimeout(ctx.idleTimeout);
  }
  const timeout = setTimeout(
    async () => {
      logInfo("Browser idle timeout reached, closing browser...");
      try {
        if (ctx.page) {
          await ctx.page.close();
          ctx.setPage(null);
        }
        if (ctx.browser) {
          await ctx.browser.close();
          ctx.setBrowser(null);
        }
        ctx.setIsInitializing(false); // Reset initialization flag
        logInfo("Browser cleanup completed successfully");
      } catch (error) {
        logError(`Error during browser cleanup: ${error}`);
        ctx.setPage(null);
        ctx.setBrowser(null);
        ctx.setIsInitializing(false);
      }
    },
    ctx.IDLE_TIMEOUT_MS ?? 5 * 60 * 1000,
  );
  ctx.setIdleTimeout(timeout);
}
